#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$DIR/helpers.sh"

# Set default values if not provided
PROJECT_ID="${PROJECT_ID:-e2e-test-$(date +%s)}"
UPLOAD_BASE="${UPLOAD_BASE:-https://reel-banana-upload-assets-223097908182.us-central1.run.app}"
NARRATE_BASE="${NARRATE_BASE:-https://reel-banana-narrate-223097908182.us-central1.run.app}"
ALIGN_BASE="${ALIGN_BASE:-https://reel-banana-align-captions-223097908182.us-central1.run.app}"
COMPOSE_BASE="${COMPOSE_BASE:-https://reel-banana-compose-music-223097908182.us-central1.run.app}"
RENDER_BASE="${RENDER_BASE:-https://reel-banana-render-223097908182.us-central1.run.app}"
NARRATION_SCRIPT="${NARRATION_SCRIPT:-This is a test narration for the E2E smoke test. It should be short and clear for testing purposes.}"
TEST_IMAGE_DATA_URI="${TEST_IMAGE_DATA_URI:-data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==}"

# Only require APP_CHECK_TOKEN if not in development mode
if [[ "${UPLOAD_BASE}" == *"localhost"* ]]; then
  yellow "Running in development mode - App Check token not required"
else
  yellow "Running in production mode - App Check token required"
  if [[ -z "${APP_CHECK_TOKEN:-}" ]]; then
    red "APP_CHECK_TOKEN is required for production E2E testing"
    red "Run: ./scripts/get-tokens.sh for instructions"
    exit 1
  fi
fi

yellow "Starting E2E smoke for project: $PROJECT_ID"
yellow "Using services:"
yellow "  Upload: $UPLOAD_BASE"
yellow "  Narrate: $NARRATE_BASE"
yellow "  Align: $ALIGN_BASE"
yellow "  Compose: $COMPOSE_BASE"
yellow "  Render: $RENDER_BASE"

# Validate that we can reach the services
yellow "Validating service endpoints..."
for service in "$UPLOAD_BASE/health" "$NARRATE_BASE/health" "$ALIGN_BASE/health" "$COMPOSE_BASE/health" "$RENDER_BASE/health"; do
  if ! curl -sS --max-time 10 "$service" >/dev/null; then
    red "Service health check failed: $service"
    exit 1
  fi
done
green "All services are reachable"

# 1) Upload a tiny image
yellow "Uploading image..."
UPLOAD_URL="$UPLOAD_BASE/upload-image"
upload_body=$(cat <<JSON
{
  "projectId": "${PROJECT_ID}",
  "fileName": "scene-0-0.jpeg",
  "base64Image": "${TEST_IMAGE_DATA_URI}"
}
JSON
)
upload_res=$(post_json "$UPLOAD_URL" "$upload_body")
echo "$upload_res" | json
if command -v jq >/dev/null 2>&1; then
  gcs_path=$(printf '%s' "$upload_res" | jq -r '.gcsPath // empty')
  assert_nonempty "$gcs_path" "Upload failed: no gcsPath"
  yellow "Uploaded to: $gcs_path"
else
  yellow "jq not available - cannot validate upload response"
fi
green "Upload OK"

# 2) Narrate
yellow "Generating narration..."
NARRATE_URL="$NARRATE_BASE/narrate"
narrate_body=$(cat <<JSON
{
  "projectId": "${PROJECT_ID}",
  "narrationScript": "${NARRATION_SCRIPT}"
}
JSON
)
narrate_res=$(post_json "$NARRATE_URL" "$narrate_body")
echo "$narrate_res" | json
if command -v jq >/dev/null 2>&1; then
  gsAudioPath=$(printf '%s' "$narrate_res" | jq -r '.gsAudioPath // empty')
  assert_nonempty "$gsAudioPath" "Narrate failed: no gsAudioPath"
  cached=$(printf '%s' "$narrate_res" | jq -r '.cached // false')
  if [[ "$cached" == "true" ]]; then
    yellow "Using cached narration: $gsAudioPath"
  else
    yellow "Generated new narration: $gsAudioPath"
  fi
else
  yellow "jq not available - cannot validate narrate response"
fi
green "Narrate OK"

# 3) Align captions
yellow "Aligning captions..."
ALIGN_URL="$ALIGN_BASE/align"
align_body=$(cat <<JSON
{
  "projectId": "${PROJECT_ID}",
  "gsAudioPath": "${gsAudioPath}"
}
JSON
)
align_res=$(post_json "$ALIGN_URL" "$align_body")
echo "$align_res" | json
if command -v jq >/dev/null 2>&1; then
  srtPath=$(printf '%s' "$align_res" | jq -r '.srtPath // empty')
  assert_nonempty "$srtPath" "Align failed: no srtPath"
  cached=$(printf '%s' "$align_res" | jq -r '.cached // false')
  if [[ "$cached" == "true" ]]; then
    yellow "Using cached captions: $srtPath"
  else
    yellow "Generated new captions: $srtPath"
  fi
else
  yellow "jq not available - cannot validate align response"
fi
green "Align OK"

# 4) Compose music
yellow "Composing music..."
COMPOSE_URL="$COMPOSE_BASE/compose-music"
compose_body=$(cat <<JSON
{
  "projectId": "${PROJECT_ID}",
  "narrationScript": "${NARRATION_SCRIPT}"
}
JSON
)
compose_res=$(post_json "$COMPOSE_URL" "$compose_body")
echo "$compose_res" | json
if command -v jq >/dev/null 2>&1; then
  gsMusicPath=$(printf '%s' "$compose_res" | jq -r '.gsMusicPath // empty')
  assert_nonempty "$gsMusicPath" "Compose failed: no gsMusicPath"
  yellow "Generated music: $gsMusicPath"
else
  yellow "jq not available - cannot validate compose response"
fi
green "Compose OK"

# 5) Render draft
yellow "Rendering (draft)..."
RENDER_URL="$RENDER_BASE/render"
render_body=$(cat <<JSON
{
  "projectId": "${PROJECT_ID}",
  "scenes": [{"narration": "Scene one", "imageCount": 1, "camera": "static", "transition": "fade", "duration": 3}],
  "gsAudioPath": "${gsAudioPath}",
  "srtPath": "${srtPath}",
  "gsMusicPath": "${gsMusicPath}",
  "published": false
}
JSON
)
render_res=$(post_json "$RENDER_URL" "$render_body")
echo "$render_res" | json
if command -v jq >/dev/null 2>&1; then
  draftVideoUrl=$(printf '%s' "$render_res" | jq -r '.videoUrl // empty')
  assert_nonempty "$draftVideoUrl" "Render (draft) failed: no videoUrl"
  yellow "Draft video URL: $draftVideoUrl"
else
  yellow "jq not available - cannot validate render response"
fi
green "Render (draft) OK"

# 6) Render publish-only (durable URL)
yellow "Marking as published (publish-only path)..."
publish_body=$(cat <<JSON
{
  "projectId": "${PROJECT_ID}",
  "published": true
}
JSON
)
publish_res=$(post_json "$RENDER_URL" "$publish_body")
echo "$publish_res" | json
if command -v jq >/dev/null 2>&1; then
  publicVideoUrl=$(printf '%s' "$publish_res" | jq -r '.videoUrl // empty')
  assert_nonempty "$publicVideoUrl" "Publish-only failed: no durable videoUrl"
  yellow "Public video URL: $publicVideoUrl"
else
  yellow "jq not available - cannot validate publish response"
fi
green "Publish-only (durable URL) OK"

# Final summary
echo ""
green "🎉 E2E smoke completed successfully for project: $PROJECT_ID"
echo ""
yellow "Summary:"
yellow "  ✅ Image uploaded: $gcs_path"
yellow "  ✅ Narration generated: $gsAudioPath"
yellow "  ✅ Captions aligned: $srtPath"
yellow "  ✅ Music composed: $gsMusicPath"
yellow "  ✅ Draft video: $draftVideoUrl"
yellow "  ✅ Public video: $publicVideoUrl"
echo ""
green "All pipeline steps completed successfully! 🚀"

