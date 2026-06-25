---
name: pr-bot-reviews
description: >-
  Triage, verdict, and reply to automated PR review comments from GitHub Copilot
  and Greptile, then iterate until the bots have nothing left to say. Use this
  whenever a pull request has feedback from Copilot or Greptile and the user
  wants those comments handled — e.g. "deal with the bot review comments",
  "address the Copilot/Greptile feedback on my PR", "go through the review bots",
  "resolve the automated review", or after pushing a branch and asking to "clear
  the AI reviewers". It judges each comment on its merits (fixing real issues,
  pushing back on nitpicks), replies inline on each thread, commits and pushes
  fixes, re-requests review from both bots, waits for the fresh round, and repeats
  until clean.
---

# PR Bot Reviews

Automated reviewers (GitHub Copilot, Greptile) leave a lot of comments. Some are
real bugs worth fixing; many are nitpicks, style preferences, or simply wrong.
Your job is to act like a thoughtful senior engineer reviewing the *reviewer*:
judge each comment honestly, fix what deserves fixing, push back on the rest with
clear reasoning, and drive the PR to a clean state.

This is a **loop**. Each round: collect the bots' open comments → verdict each →
apply accepted fixes → reply inline on every thread → commit & push → re-request
both bots → wait for the fresh review → repeat. Stop when a new round produces no
actionable comments.

## Principle: you are pragmatic, not obedient

Bots optimize for *finding things to say*, not for whether the change is worth
making. Do not blindly comply. The bar for a change is: **would a thoughtful
senior engineer make this change?** If yes, make it. If not, decline and say why.

- **Fix:** correctness bugs, security issues, data-loss risks, resource leaks,
  off-by-one / null / boundary errors, broken edge cases, genuinely confusing
  code, clear violations of the repo's own conventions.
- **Push back:** subjective style, speculative "what if" hardening for impossible
  inputs, premature abstraction, churn for marginal gain, suggestions that
  contradict project conventions (cite `CLAUDE.md` or surrounding code), or
  anything that would add complexity without real benefit. The project guidelines
  here explicitly favor simplicity and surgical changes — defend that.
- **Verify before trusting.** Bots hallucinate. Open the file at the referenced
  `path:line` and read the surrounding code before accepting a claim. Confirm the
  problem is real against the *actual* code, not just the snippet in the comment.
  Reject confidently-worded comments that are factually wrong, and say so plainly.
- **Never accept a "fix" that introduces a regression** or breaks a convention
  just to silence a bot. A wrong fix is worse than an open comment.

When you decline, be concrete and respectful — explain the reasoning, cite the
code or convention, and leave room that you might have misread it. You are having
a technical conversation, not winning an argument.

## Prerequisites

- `gh` is authenticated (`gh auth status`). The repo resolves from the cwd.
- A PR exists for the current branch. Get its context:

  ```bash
  gh pr view --json number,headRefOid,state,url
  ```

  If there is no PR, stop and tell the user — there is nothing to review.

The bot author logins this skill targets:

| Bot | `user.login` |
|-----|--------------|
| GitHub Copilot | `copilot-pull-request-reviewer[bot]` |
| Greptile | `greptile-apps[bot]` |

## The loop

### 1. Collect open bot comments

Run the helper, which returns only **unresolved** inline threads authored by the
two bots that you have **not already replied to** (so old/handled threads are
skipped automatically):

```bash
.claude/skills/pr-bot-reviews/scripts/fetch-bot-threads.sh <pr-number>
```

It prints a JSON array of `{thread_id, comment_id, author, path, line, body}`.
If the array is empty, the bots have nothing open — go to **Termination**.

### 2. Verdict each comment

For every thread, open `path` around `line`, read the real code, and decide
**ACCEPT** (fix it) or **REJECT** (push back), following the pragmatism principle
above. Treat each comment on its own merits — bots sometimes contradict each
other. Jot a one-line rationale per comment; you'll turn these into replies.

### 3. Apply accepted fixes

Make the **minimal correct change** for each ACCEPT. Match surrounding style.
Don't "improve" adjacent code. Batch all of a round's fixes together, then commit
and push **once** so the bots re-review a single new head commit:

```bash
git add -A
git commit -m "fix: address review comments"   # match the repo's commit conventions
git push
NEW_SHA="$(gh pr view --json headRefOid --jq .headRefOid)"
```

If a round has **zero** accepted fixes (all rejected), skip the commit/push —
there's no new code to review. Still post your replies (step 4), then go to
**Termination** rather than re-requesting (nothing changed for the bots to look
at).

### 4. Reply inline on every thread

Reply on each thread's **root** comment (`comment_id` from the helper). Use the
REST replies endpoint; pass the body on stdin so multi-line text is clean:

```bash
gh api --method POST \
  "repos/{owner}/{repo}/pulls/<pr>/comments/<comment_id>/replies" \
  -F body=@- <<'EOF'
<your reply>
EOF
```

Reply to **both** accepted and rejected comments — silence reads as ignoring the
reviewer. Keep replies short and specific:

- **Accepted:** ``Good catch — fixed in `<sha>`. <one line on what changed>.``
- **Rejected:** ``Leaving as-is: <reason>. <cite the code/convention>.``

Optionally resolve threads you've definitively handled to keep the PR tidy (see
`references/extras.md`). Resolving is not required — the fetch helper already
skips threads you've replied to, so they won't reappear next round.

### 5. Re-request both bots

Only if you pushed a new commit in this round.

**Copilot** (this `gh` is < 2.88, so the `--add-reviewer @copilot` flag is
unavailable — use the REST remove-then-add; re-adding an already-requested
reviewer is a no-op otherwise):

```bash
gh api --method DELETE "repos/{owner}/{repo}/pulls/<pr>/requested_reviewers" \
  -f "reviewers[]=copilot-pull-request-reviewer[bot]" 2>/dev/null || true
gh api --method POST   "repos/{owner}/{repo}/pulls/<pr>/requested_reviewers" \
  -f "reviewers[]=copilot-pull-request-reviewer[bot]"
```

**Greptile** (re-reviews on a mention; the handle is `@greptileai`):

```bash
gh pr comment <pr> --body "@greptileai review"
```

### 6. Wait for the fresh review

Poll until each re-requested bot posts a review against `NEW_SHA`. Matching on the
commit SHA (not a timestamp) is the robust signal that it's *this* round, not an
old one. Run the helper once per bot, and give the **Bash tool a 600000 ms
timeout** since bots can take a few minutes:

```bash
.claude/skills/pr-bot-reviews/scripts/wait-for-review.sh <pr> "$NEW_SHA" "copilot-pull-request-reviewer[bot]"
.claude/skills/pr-bot-reviews/scripts/wait-for-review.sh <pr> "$NEW_SHA" "greptile-apps[bot]"
```

It prints `ready` on success or `timeout` after ~10 min. If it times out, re-run
it to keep waiting; after a second timeout, report the stall to the user instead
of looping forever. Once both are ready, go back to **step 1**.

## Termination

Stop the loop when **a fresh review round produces no actionable bot comments**
(the fetch helper returns `[]`, or the only new comments are approvals / "LGTM" /
pure praise). Also stop, and report, if:

- A round has zero accepted fixes and you've replied to everything (nothing left
  to push), **or**
- Polling stalls past two timeouts, **or**
- You've run ~5 rounds without converging — surface what's still contested and
  let the user decide.

Then give a concise final report:

```
PR #<n> — bot review: <N> rounds
Accepted & fixed: <count>   (one bullet each: file:line — what changed)
Pushed back:      <count>   (one bullet each: file:line — why)
Status: clean / stalled / handed back
```

## Files

- `scripts/fetch-bot-threads.sh` — list unresolved, un-replied bot threads as JSON.
- `scripts/wait-for-review.sh` — poll until a bot reviews a given commit SHA.
- `references/extras.md` — resolving threads, verifying bot logins, gotchas.
