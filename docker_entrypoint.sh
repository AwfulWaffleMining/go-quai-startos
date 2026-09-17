#!/bin/sh
# All flags are assembled in startos/main.ts and passed through as "$@".
set -eu

# The nodelogs symlink in the image points here; it must exist before
# go-quai tries to create its log files.
mkdir -p /data/go-quai /data/config /data/nodelogs

cd /opt/go-quai
exec /usr/local/bin/go-quai start "$@"
