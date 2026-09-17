#!/bin/sh
set -eu

# Runtime data is shared with the maintenance container through GID 10001.
# Keep newly created files owner-writable and group-readable so backups,
# recovery, and selective production updates can read uploaded assets without
# making them world-readable.
umask 0027

MEDIA_PID=""
HUB_PID=""
cleanup(){
  trap - INT TERM EXIT
  [ -n "$HUB_PID" ] && kill -TERM "$HUB_PID" 2>/dev/null || true
  [ -n "$MEDIA_PID" ] && kill -TERM "$MEDIA_PID" 2>/dev/null || true
  [ -n "$HUB_PID" ] && wait "$HUB_PID" 2>/dev/null || true
  [ -n "$MEDIA_PID" ] && wait "$MEDIA_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

node ./src/media-server.js &
MEDIA_PID=$!

node --require ./src/direct-display-compat.js src/startup-recovery.js &
HUB_PID=$!

# If either critical process exits, terminate the other so Docker restart policy
# restores a converged control+media pair instead of leaving a half-running hub.
while :; do
  if ! kill -0 "$HUB_PID" 2>/dev/null; then
    wait "$HUB_PID" || rc=$?
    rc=${rc:-0}
    kill -TERM "$MEDIA_PID" 2>/dev/null || true
    wait "$MEDIA_PID" 2>/dev/null || true
    trap - INT TERM EXIT
    exit "$rc"
  fi
  if ! kill -0 "$MEDIA_PID" 2>/dev/null; then
    wait "$MEDIA_PID" || rc=$?
    rc=${rc:-1}
    kill -TERM "$HUB_PID" 2>/dev/null || true
    wait "$HUB_PID" 2>/dev/null || true
    trap - INT TERM EXIT
    exit "$rc"
  fi
  sleep 1
done
