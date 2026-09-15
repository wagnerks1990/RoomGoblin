#!/usr/bin/env bash
set -euo pipefail

# Runtime data is shared with the maintenance container through GID 10001.
# Keep newly created files owner-writable and group-readable so backups,
# recovery, and selective production updates can read uploaded assets without
# making them world-readable.
umask 0027

exec node --require ./src/direct-display-compat.js src/startup-recovery.js
