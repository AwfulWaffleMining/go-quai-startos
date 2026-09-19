#!/bin/sh
# Restores go-quai chain data from a snapshot before the node starts.
# Runs as a oneshot on every start; exits immediately when there is nothing to do.
#
# Inputs (set by startos/main.ts from store.json):
#   BOOTSTRAP_REQUEST_ID  empty = no restore requested (sync from genesis / already chosen)
#   BOOTSTRAP_URL         snapshot URL (.tar.zst with one top-level folder)
#   BOOTSTRAP_SHA256      optional expected SHA256 of the archive
#
# Layout under $DATA_ROOT (the service volume, /data):
#   go-quai/               chain data (go-quai --global.data-dir)
#   go-quai/.bootstrap-id  request id of the restore that produced this chain data
#   bootstrap/             download workspace + status.json for the health check
set -eu

ROOT="${DATA_ROOT:-/data}"
REQ="${BOOTSTRAP_REQUEST_ID:-}"
URL="${BOOTSTRAP_URL:-}"
SHA="$(printf '%s' "${BOOTSTRAP_SHA256:-}" | tr 'A-F' 'a-f')"
CURL_EXTRA="${BOOTSTRAP_CURL_EXTRA:-}" # testing only, e.g. --limit-rate

DATA="$ROOT/go-quai"
WORK="$ROOT/bootstrap"
ARCHIVE="$WORK/snapshot.tar.zst"
STATUS="$WORK/status.json"
CHILD=""

log() { echo "[bootstrap] $*"; }

status() { # phase done total message
  mkdir -p "$WORK"
  msg=$(printf '%s' "$4" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"requestId":"%s","phase":"%s","done":%s,"total":%s,"message":"%s"}\n' \
    "$REQ" "$1" "${2:-0}" "${3:-0}" "$msg" >"$STATUS.tmp"
  mv "$STATUS.tmp" "$STATUS"
}

# StartOS retries a failed oneshot every few seconds (backoff capped at 30 s).
# Failures that retrying cannot fix wait before exiting, so they don't spam the
# log or hit the snapshot server twice a minute. The wait is interruptible, so
# stopping the service still takes effect immediately.
pause() {
  sleep "$1" &
  CHILD=$!
  wait "$CHILD" || true
  CHILD=""
}

fail() { # message [permanent|wait]
  log "ERROR: $1"
  status error 0 0 "$1"
  case "${2:-}" in
  permanent)
    printf '%s' "$REQ" >"$WORK/failed-id"
    pause 300
    ;;
  wait) pause 300 ;;
  esac
  exit 1
}

gb() { awk -v b="$1" 'BEGIN { if (b >= 1000000000) printf "%.1f GB", b / 1000000000; else printf "%.0f MB", b / 1000000 }'; }

filesize() { stat -c %s "$1" 2>/dev/null || echo 0; }

trap '[ -n "$CHILD" ] && kill "$CHILD" 2>/dev/null; exit 143' TERM INT

# ── Nothing to do? ─────────────────────────────────────────────────────────────
if [ -z "$REQ" ]; then
  # Syncing from genesis: drop any partial download from an abandoned restore.
  rm -rf "$WORK"
  exit 0
fi
if [ -f "$DATA/.bootstrap-id" ] && [ "$(cat "$DATA/.bootstrap-id")" = "$REQ" ]; then
  exit 0
fi

mkdir -p "$WORK"

# A request that already failed permanently (bad checksum, bad archive) is not
# retried automatically; running the Sync Method action again creates a new one.
if [ -f "$WORK/failed-id" ] && [ "$(cat "$WORK/failed-id")" = "$REQ" ]; then
  log "Previous restore attempt failed permanently; run the Sync Method action to try again."
  pause 300
  exit 1
fi

# A different request than the partial download on disk: start that download over.
if [ "$(cat "$WORK/request-id" 2>/dev/null || true)" != "$REQ" ]; then
  rm -f "$ARCHIVE" "$WORK/failed-id"
  printf '%s' "$REQ" >"$WORK/request-id"
fi

[ -n "$URL" ] || fail "No snapshot URL is set. Run the Sync Method action." permanent

# ── Size and free space ────────────────────────────────────────────────────────
status checking 0 0 "Checking snapshot size and free space"
log "Snapshot: $URL"

TOTAL=$(curl -sSfIL --max-time 60 "$URL" 2>/dev/null |
  awk 'tolower($1) == "content-length:" { v = $2 } END { gsub("\r", "", v); print v + 0 }') || TOTAL=0
HAVE=$(filesize "$ARCHIVE")

if [ "$TOTAL" -gt 0 ]; then
  AVAIL=$(($(df -Pk "$ROOT" | awk 'NR == 2 { print $4 }') * 1024))
  # Remaining download, plus the unpacked chain. Measured on a real restore:
  # a 225 GB archive unpacked to 271 GB (1.2x), so 1.5x leaves headroom.
  # Existing chain data is only removed after a successful extraction, so it
  # does not count as free space.
  NEED=$((TOTAL - HAVE + (3 * TOTAL) / 2))
  if [ "$NEED" -gt "$AVAIL" ]; then
    fail "Not enough free space: the snapshot needs about $(gb "$NEED") (download plus unpacked chain), but only $(gb "$AVAIL") is free." wait
  fi
  log "Size $(gb "$TOTAL"), already downloaded $(gb "$HAVE"), free $(gb "$AVAIL")"
else
  log "WARNING: the server did not report the snapshot size; skipping the free-space check."
fi

# ── Download (resumable) ───────────────────────────────────────────────────────
# Every attempt is a fresh curl with -C -, which resumes from the file on disk.
# Do NOT use curl's own --retry: on retry curl truncates the output file back to
# the offset that invocation started at (0 for a fresh download), throwing away
# everything downloaded so far. --speed-limit/--speed-time turn a silent stall
# into a quick failure instead of waiting for the OS TCP timeout (~10 minutes).
STALL_SECONDS="${BOOTSTRAP_STALL_SECONDS:-120}"
RETRY_DELAY="${BOOTSTRAP_RETRY_DELAY:-15}"
MAX_IDLE_ATTEMPTS=10
IDLE_ATTEMPTS=0
LAST_PCT=-1
while :; do
  HAVE=$(filesize "$ARCHIVE")
  if [ "$TOTAL" -gt 0 ] && [ "$HAVE" -ge "$TOTAL" ]; then
    break
  fi
  if [ "$HAVE" -gt 0 ]; then
    log "Resuming download at $(gb "$HAVE")"
  else
    log "Downloading..."
  fi
  rm -f "$WORK/http-code"
  # shellcheck disable=SC2086
  curl -sSfL --connect-timeout 30 --speed-limit 102400 --speed-time "$STALL_SECONDS" \
    -C - $CURL_EXTRA -w '%{http_code}' -o "$ARCHIVE" "$URL" >"$WORK/http-code" &
  CHILD=$!
  while kill -0 "$CHILD" 2>/dev/null; do
    NOW=$(filesize "$ARCHIVE")
    if [ "$TOTAL" -gt 0 ]; then
      PCT=$((NOW * 100 / TOTAL))
      status downloading "$NOW" "$TOTAL" "Downloading snapshot: $(gb "$NOW") of $(gb "$TOTAL") ($PCT%)"
      if [ $((PCT / 5)) -ne $((LAST_PCT / 5)) ]; then
        log "Downloaded $(gb "$NOW") of $(gb "$TOTAL") ($PCT%)"
        LAST_PCT=$PCT
      fi
    else
      status downloading "$NOW" 0 "Downloading snapshot: $(gb "$NOW")"
    fi
    sleep 5
  done
  RC=0
  wait "$CHILD" || RC=$?
  CHILD=""
  NOW=$(filesize "$ARCHIVE")

  if [ "$RC" -eq 0 ] && { [ "$TOTAL" -eq 0 ] || [ "$NOW" -ge "$TOTAL" ]; }; then
    break
  fi
  HTTP_CODE=$(cat "$WORK/http-code" 2>/dev/null || echo 000)
  case "$HTTP_CODE" in
  408 | 429) ;; # timeout / rate limited: worth retrying
  4??)
    fail "The snapshot URL returned HTTP $HTTP_CODE. Check the URL with the Sync Method action." wait
    ;;
  esac
  if [ "$RC" -eq 33 ]; then
    rm -f "$ARCHIVE"
    fail "The snapshot server does not support resuming downloads; the download will restart on the next start."
  fi
  if [ "$TOTAL" -gt 0 ] && [ "$NOW" -gt "$TOTAL" ]; then
    rm -f "$ARCHIVE"
    fail "Downloaded file is larger than the snapshot ($NOW > $TOTAL bytes); it was deleted and will download again."
  fi

  if [ "$NOW" -gt "$HAVE" ]; then
    IDLE_ATTEMPTS=0
  else
    IDLE_ATTEMPTS=$((IDLE_ATTEMPTS + 1))
  fi
  if [ "$IDLE_ATTEMPTS" -ge "$MAX_IDLE_ATTEMPTS" ]; then
    fail "Download made no progress in $MAX_IDLE_ATTEMPTS attempts (curl exit $RC). $(gb "$NOW") is kept and will resume." wait
  fi
  log "Download interrupted at $(gb "$NOW") (curl exit $RC); resuming in ${RETRY_DELAY}s"
  status downloading "$NOW" "$TOTAL" "Download interrupted at $(gb "$NOW"); resuming in ${RETRY_DELAY}s"
  pause "$RETRY_DELAY"
done

GOT=$(filesize "$ARCHIVE")
if [ "$TOTAL" -gt 0 ] && [ "$GOT" -ne "$TOTAL" ]; then
  fail "Downloaded $GOT bytes but expected $TOTAL. It will resume on the next start."
fi
log "Download complete: $(gb "$GOT")"

# ── Verify ─────────────────────────────────────────────────────────────────────
if [ -n "$SHA" ]; then
  status verifying 0 "$GOT" "Verifying SHA256 of $(gb "$GOT") (this takes a while)"
  log "Verifying SHA256..."
  ACTUAL=$(sha256sum "$ARCHIVE" | awk '{ print $1 }')
  if [ "$ACTUAL" != "$SHA" ]; then
    rm -f "$ARCHIVE"
    fail "SHA256 mismatch: expected $SHA, got $ACTUAL. The download was deleted. Check the URL and checksum, then run the Sync Method action again." permanent
  fi
  log "SHA256 verified"
fi

# ── Extract ────────────────────────────────────────────────────────────────────
status extracting 0 "$GOT" "Extracting snapshot"
log "Extracting..."
rm -rf "$DATA.partial"
mkdir -p "$DATA.partial"

rm -f "$WORK/zstd.rc"
{
  zstd -dc -T0 "$ARCHIVE"
  echo $? >"$WORK/zstd.rc"
} | tar -xf - -C "$DATA.partial" --strip-components=1 &
CHILD=$!
while kill -0 "$CHILD" 2>/dev/null; do
  # Read position of whichever process has the archive open (the zstd decoder).
  POS=0
  for fd in /proc/[0-9]*/fd/*; do
    if [ "$(readlink "$fd" 2>/dev/null)" = "$ARCHIVE" ]; then
      pid=${fd#/proc/}
      pid=${pid%%/*}
      POS=$(awk '/^pos:/ { print $2 }' "/proc/$pid/fdinfo/${fd##*/}" 2>/dev/null || echo 0)
      break
    fi
  done
  status extracting "${POS:-0}" "$GOT" "Extracting snapshot: $(gb "${POS:-0}") of $(gb "$GOT")"
  sleep 5
done
TAR_RC=0
wait "$CHILD" || TAR_RC=$?
CHILD=""
ZSTD_RC=$(cat "$WORK/zstd.rc" 2>/dev/null || echo 1)
if [ "$ZSTD_RC" -ne 0 ] || [ "$TAR_RC" -ne 0 ]; then
  rm -rf "$DATA.partial"
  rm -f "$ARCHIVE"
  fail "Extraction failed (zstd $ZSTD_RC, tar $TAR_RC). The archive may be corrupt and was deleted; existing chain data was not touched. Run the Sync Method action to try again." permanent
fi

# Must look like a go-quai data directory.
if [ ! -d "$DATA.partial/prime/go-quai" ] || [ ! -d "$DATA.partial/zone-0-0/go-quai" ]; then
  rm -rf "$DATA.partial"
  rm -f "$ARCHIVE"
  fail "The archive does not contain go-quai chain data (expected prime/ and zone-0-0/ inside one top-level folder). Existing chain data was not touched." permanent
fi

# Drop the snapshot creator's peer database (folders named after the genesis hash).
for d in "$DATA.partial"/0x*; do
  [ -d "$d" ] && rm -rf "$d"
done

# Only now replace any existing chain data.
rm -rf "$DATA"
mv "$DATA.partial" "$DATA"
printf '%s' "$REQ" >"$DATA/.bootstrap-id"
rm -f "$ARCHIVE" "$WORK/request-id" "$WORK/zstd.rc" "$WORK/http-code"
status complete "$GOT" "$GOT" "Snapshot restored"
log "Snapshot restored. Starting go-quai."
exit 0
