#!/usr/bin/env bash
# List unresolved inline review threads authored by Copilot/Greptile that the
# current user has NOT already replied to. Output: JSON array of
# {thread_id, comment_id, author, path, line, body}.
#
# Usage: fetch-bot-threads.sh <pr-number>
#
# thread_id   = GraphQL node id (for resolveReviewThread; see references/extras.md)
# comment_id  = REST databaseId of the thread root (for the /replies endpoint)
set -euo pipefail

PR="${1:?usage: fetch-bot-threads.sh <pr-number>}"
ME="$(gh api user --jq .login)"
read -r OWNER REPO < <(gh repo view --json owner,name --jq '"\(.owner.login) \(.name)"')

gh api graphql \
  -F owner="$OWNER" -F repo="$REPO" -F pr="$PR" \
  -f query='
    query($owner:String!, $repo:String!, $pr:Int!) {
      repository(owner:$owner, name:$repo) {
        pullRequest(number:$pr) {
          reviewThreads(first:100) {
            nodes {
              id
              isResolved
              comments(first:50) {
                nodes { databaseId author { login } body path line }
              }
            }
          }
        }
      }
    }' \
| jq --arg me "$ME" '
    [ .data.repository.pullRequest.reviewThreads.nodes[]
      | select(.isResolved | not)
      | .comments.nodes as $c
      | ($c[0]) as $root
      | select($root.author.login == "copilot-pull-request-reviewer[bot]"
            or $root.author.login == "greptile-apps[bot]")
      | select([$c[].author.login] | index($me) | not)
      | { thread_id: .id,
          comment_id: $root.databaseId,
          author: $root.author.login,
          path: $root.path,
          line: $root.line,
          body: $root.body }
    ]'
