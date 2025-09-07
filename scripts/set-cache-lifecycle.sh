#!/usr/bin/env bash
set -euo pipefail

BUCKET=${1:-reel-banana-35a54.firebasestorage.app}
DAYS=${2:-45}

TMP_JSON=$(mktemp)
cat > "$TMP_JSON" <<JSON
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": $DAYS, "matchesPrefix": ["cache/"] }
    }
  ]
}
JSON

echo "Applying lifecycle to gs://$BUCKET for cache/* after $DAYS days..."
gcloud storage buckets update gs://$BUCKET --lifecycle-file="$TMP_JSON"
echo "Done. Current lifecycle:"
gcloud storage buckets describe gs://$BUCKET --format json | jq .lifecycle

