#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3105}"
BASE_URL="http://127.0.0.1:${PORT}"
DEV_LOG="$(mktemp -t speedtest-dev-log.XXXXXX)"
SMOKE_DIR="$(mktemp -d -t speedtest-smoke.XXXXXX)"

cleanup() {
  if [[ -n "${DEV_PID:-}" ]] && kill -0 "${DEV_PID}" >/dev/null 2>&1; then
    kill "${DEV_PID}" >/dev/null 2>&1 || true
    wait "${DEV_PID}" >/dev/null 2>&1 || true
  fi
  rm -f "${DEV_LOG}"
  rm -rf "${SMOKE_DIR}"
}
trap cleanup EXIT

npm run dev -- -p "${PORT}" >"${DEV_LOG}" 2>&1 &
DEV_PID=$!

echo "Waiting for dev server on ${BASE_URL}..."
for _ in $(seq 1 60); do
  if curl -fsS "${BASE_URL}/api/speed/ping" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! curl -fsS "${BASE_URL}/api/speed/ping" >/dev/null 2>&1; then
  echo "Dev server did not become ready. Log:"
  cat "${DEV_LOG}"
  exit 1
fi

echo "Checking ping route..."
PING_HEADERS="${SMOKE_DIR}/ping.headers"
curl -sS -D "${PING_HEADERS}" -o /dev/null "${BASE_URL}/api/speed/ping"
grep -qi "^HTTP/.* 200" "${PING_HEADERS}"
grep -qi "^cache-control: .*no-store" "${PING_HEADERS}"

echo "Checking download route..."
DOWNLOAD_HEADERS="${SMOKE_DIR}/download.headers"
DOWNLOAD_BODY="${SMOKE_DIR}/download.bin"
curl -sS -D "${DOWNLOAD_HEADERS}" -o "${DOWNLOAD_BODY}" \
  "${BASE_URL}/api/speed/download?mb=1"
grep -qi "^HTTP/.* 200" "${DOWNLOAD_HEADERS}"
grep -qi "^content-length: 1048576" "${DOWNLOAD_HEADERS}"
grep -qi "^x-max-mb: 32" "${DOWNLOAD_HEADERS}"
[[ "$(wc -c <"${DOWNLOAD_BODY}" | tr -d ' ')" == "1048576" ]]

echo "Checking upload route (accepted payload)..."
UPLOAD_OK_HEADERS="${SMOKE_DIR}/upload_ok.headers"
UPLOAD_OK_BODY="${SMOKE_DIR}/upload_ok.json"
head -c 1048576 /dev/zero | \
  curl -sS -D "${UPLOAD_OK_HEADERS}" -o "${UPLOAD_OK_BODY}" \
    -X POST --data-binary @- "${BASE_URL}/api/speed/upload"
grep -qi "^HTTP/.* 200" "${UPLOAD_OK_HEADERS}"
grep -qi "^x-max-bytes: 8388608" "${UPLOAD_OK_HEADERS}"
grep -q '"ok":true' "${UPLOAD_OK_BODY}"

echo "Checking upload route (oversized payload)..."
UPLOAD_FAIL_HEADERS="${SMOKE_DIR}/upload_fail.headers"
UPLOAD_FAIL_BODY="${SMOKE_DIR}/upload_fail.json"
head -c $((9 * 1024 * 1024)) /dev/zero | \
  curl -sS -D "${UPLOAD_FAIL_HEADERS}" -o "${UPLOAD_FAIL_BODY}" \
    -X POST --data-binary @- "${BASE_URL}/api/speed/upload"
grep -qi "^HTTP/.* 413" "${UPLOAD_FAIL_HEADERS}"
grep -qi "^x-max-bytes: 8388608" "${UPLOAD_FAIL_HEADERS}"
grep -q 'payload too large' "${UPLOAD_FAIL_BODY}"

echo "API smoke checks passed."
