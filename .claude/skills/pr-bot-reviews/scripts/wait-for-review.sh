#!/usr/bin/env bash
# Poll until a bot submits a review against a given commit SHA, or time out.
# Matching on commit SHA (not timestamp) is immune to clock skew and reliably
# distinguishes this round's review from older ones.
#
# Usage: wait-for-review.sh <pr-number> <head-sha> <bot-login> [timeout-seconds]
# Prints "ready" and exits 0 when found; prints "timeout" and exits 1 otherwise.
set -euo pipefail

PR="${1:?pr-number}"; SHA="${2:?head-sha}"; BOT="${3:?bot-login}"; TIMEOUT="${4:-600}"
read -r OWNER REPO < <(gh repo view --json owner,name --jq '"\(.owner.login) \(.name)"')

deadline=$(( $(date +%s) + TIMEOUT ))
while :; do
  n="$(gh api --paginate "repos/$OWNER/$REPO/pulls/$PR/reviews" \
        --jq "[.[] | select(.user.login==\"$BOT\" and .commit_id==\"$SHA\")] | length")"
  if [ "${n:-0}" -gt 0 ]; then echo "ready"; exit 0; fi
  if [ "$(date +%s)" -ge "$deadline" ]; then echo "timeout"; exit 1; fi
  sleep 20
done
