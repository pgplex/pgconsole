# Extras & gotchas

## Verifying bot logins for a PR

Author logins occasionally change. Confirm what's actually posting on a PR:

```bash
gh api "repos/{owner}/{repo}/pulls/<pr>/comments" --jq '.[].user.login' | sort -u
```

Expected: `copilot-pull-request-reviewer[bot]`, `greptile-apps[bot]`. If you see a
different bot login, add it to the `select(...)` filter in
`scripts/fetch-bot-threads.sh`.

## Resolving threads (optional cleanup)

The fetch helper already skips threads you've replied to, so resolving isn't
required for the loop to converge. But resolving handled threads keeps the PR's
"unresolved conversations" count honest. Use the GraphQL mutation with the
`thread_id` (node id) returned by the fetch helper:

```bash
gh api graphql -f query='
  mutation($id:ID!) {
    resolveReviewThread(input:{threadId:$id}) {
      thread { isResolved }
    }
  }' -F id="<thread_id>"
```

Reasonable policy: resolve threads you ACCEPTED and fixed; leave REJECTED threads
open so a human can weigh in on your pushback if they disagree.

## Re-request / re-review mechanics

- **Copilot:** Re-POSTing an already-requested reviewer is a no-op — it does
  **not** trigger a fresh pass. Remove then re-add (as the SKILL does). On
  `gh >= 2.88.0` you can instead use `gh pr edit <pr> --add-reviewer "@copilot"`.
- **Greptile:** Reviews only the initial open by default; new commits trigger a
  re-review **only** if the repo's `greptile.json` sets `"triggerOnUpdates": true`.
  The mention `@greptileai review` reliably forces a re-review regardless. The
  handle is `@greptileai` (not `@greptile`).

## Comment namespaces

- Inline, diff-anchored review comments: `repos/{owner}/{repo}/pulls/<pr>/comments`
  — this is what the bots use, and what the fetch helper reads (via GraphQL
  `reviewThreads`, which groups them into threads with resolution state).
- Top-level PR conversation comments: `repos/{owner}/{repo}/issues/<pr>/comments`
  — not used by this skill except for the Greptile `@greptileai` trigger
  (`gh pr comment`).

## Replies target the thread root

The `/comments/<id>/replies` endpoint only accepts the **root** comment id of a
thread (the comment whose `in_reply_to_id` is null). The fetch helper already
returns the root's `databaseId` as `comment_id`, so use that directly.

## If a bot pushes back on your reply

This loop is driven by **new review rounds on new commits**, not by re-litigating
old threads — the fetch helper treats a thread you've replied to as settled. If a
bot replies to disagree and the point has merit, surface it to the user rather
than entering an endless back-and-forth with a bot.
