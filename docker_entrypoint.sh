#!/bin/sh
# All flags are assembled in startos/main.ts and passed through as "$@".
set -eu

# The nodelogs symlink in the image points here; it must exist before
# go-quai tries to create its log files.
mkdir -p /data/go-quai /data/config /data/nodelogs

cd /opt/go-quai

# go-quai returns a non-zero code after a graceful SIGTERM shutdown, which
# StartOS logs as "exited with code 1" on an ordinary stop. Run it in the
# background so we can tell a requested stop from a real failure.
stopping=0
/usr/local/bin/go-quai start "$@" &
node_pid=$!
trap 'stopping=1; kill -TERM "$node_pid" 2>/dev/null' TERM INT
wait "$node_pid"
rc=$?
if [ "$stopping" = 1 ]; then
  exit 0
fi
exit "$rc"
