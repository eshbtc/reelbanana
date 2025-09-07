#!/usr/bin/env bash
set -euo pipefail

echo "== ReelBanana Services Health Smoke Test =="

cleanup() {
  [[ -n "${NARRATE_PID:-}" ]] && kill "${NARRATE_PID}" >/dev/null 2>&1 || true
  [[ -n "${ALIGN_PID:-}" ]] && kill "${ALIGN_PID}" >/dev/null 2>&1 || true
  [[ -n "${RENDER_PID:-}" ]] && kill "${RENDER_PID}" >/dev/null 2>&1 || true
  [[ -n "${COMPOSE_PID:-}" ]] && kill "${COMPOSE_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Ports
PORT_NARRATE=8080
PORT_ALIGN=8081
PORT_RENDER=8082
PORT_COMPOSE=8084

# Common envs
export INPUT_BUCKET_NAME=${INPUT_BUCKET_NAME:-reel-banana-35a54.appspot.com}
export OUTPUT_BUCKET_NAME=${OUTPUT_BUCKET_NAME:-reel-banana-35a54.appspot.com}

# Start services
ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY:-dummy} PORT=${PORT_NARRATE} node backend/narrate/index.js &
NARRATE_PID=$!

PORT=${PORT_ALIGN} node backend/align-captions/index.js &
ALIGN_PID=$!

PORT=${PORT_RENDER} node backend/render/index.js &
RENDER_PID=$!

ELEVENLABS_MUSIC_API_KEY=${ELEVENLABS_MUSIC_API_KEY:-dummy} GEMINI_API_KEY=${GEMINI_API_KEY:-dummy} PORT=${PORT_COMPOSE} node backend/compose-music/index.js &
COMPOSE_PID=$!

# Allow boot
sleep 2

echo "--- GET /health (narrate) ---"
curl -sS http://127.0.0.1:${PORT_NARRATE}/health | jq . || true

echo "--- GET /health/detailed (narrate) expect 401 ---"
curl -sS -o /dev/stderr -w "HTTP_STATUS:%{http_code}\n" http://127.0.0.1:${PORT_NARRATE}/health/detailed || true

echo "--- GET /health (align) ---"
curl -sS http://127.0.0.1:${PORT_ALIGN}/health | jq . || true

echo "--- GET /health/detailed (align) expect 401 ---"
curl -sS -o /dev/stderr -w "HTTP_STATUS:%{http_code}\n" http://127.0.0.1:${PORT_ALIGN}/health/detailed || true

echo "--- GET /health (render) ---"
curl -sS http://127.0.0.1:${PORT_RENDER}/health | jq . || true

echo "--- GET /sli-dashboard (render) expect 401 ---"
curl -sS -o /dev/stderr -w "HTTP_STATUS:%{http_code}\n" http://127.0.0.1:${PORT_RENDER}/sli-dashboard || true

echo "--- GET /health (compose-music) ---"
curl -sS http://127.0.0.1:${PORT_COMPOSE}/health | jq . || true

echo "✅ Health smoke test completed"

