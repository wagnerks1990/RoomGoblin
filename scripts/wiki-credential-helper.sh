#!/bin/sh
# Git invokes this helper only for the hosted Wiki transport. Never persist credentials.
set -eu
[ "${1:-}" = get ] || exit 0
protocol= host= credential_path=
while IFS='=' read -r key value; do
  case "$key" in
    protocol) protocol=$value ;;
    host) host=$value ;;
    path) credential_path=$value ;;
  esac
done
[ "$protocol" = https ] && [ "$host" = github.com ] || exit 0
[ -n "${GITHUB_REPOSITORY:-}" ] || exit 0
[ "$credential_path" = "$GITHUB_REPOSITORY.wiki.git" ] || exit 0
[ -n "${GH_TOKEN:-}" ] || exit 0
printf 'username=x-access-token\npassword=%s\n' "$GH_TOKEN"
