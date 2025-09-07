#!/usr/bin/env bash
set -euo pipefail

# Load env if present
if [[ -f "$(dirname "$0")/.env.smoke" ]]; then
  # shellcheck disable=SC1091
  source "$(dirname "$0")/.env.smoke"
fi

require() {
  local name="$1"; local val
  val="${!name-}"
  if [[ -z "${val}" ]]; then
    echo "[ERR] Missing required env var: $name" >&2
    exit 1
  fi
}

json() {
  # Pretty print JSON if jq is available
  if command -v jq >/dev/null 2>&1; then jq -r '.'; else cat; fi
}

header_args() {
  local args=("-H" "Content-Type: application/json" "-H" "X-Firebase-AppCheck: ${APP_CHECK_TOKEN}")
  if [[ -n "${ID_TOKEN:-}" ]]; then
    args+=("-H" "Authorization: Bearer ${ID_TOKEN}")
  fi
  printf '%s ' "${args[@]}" | sed 's/ $//'
}

post_json() {
  local url="$1"; shift
  local body="$1"; shift
  local headers=("-H" "Content-Type: application/json" "-H" "X-Firebase-AppCheck: ${APP_CHECK_TOKEN}")
  if [[ -n "${ID_TOKEN:-}" ]]; then
    headers+=("-H" "Authorization: Bearer ${ID_TOKEN}")
  fi
  curl -sS -X POST "${url}" "${headers[@]}" -d "${body}"
}

get_json() {
  local url="$1"; shift
  local headers=("-H" "Content-Type: application/json" "-H" "X-Firebase-AppCheck: ${APP_CHECK_TOKEN}")
  if [[ -n "${ID_TOKEN:-}" ]]; then
    headers+=("-H" "Authorization: Bearer ${ID_TOKEN}")
  fi
  curl -sS -X GET "${url}" "${headers[@]}"
}

assert_nonempty() {
  local value="$1"; local msg="$2"
  if [[ -z "$value" ]]; then
    echo "[ERR] ${msg}" >&2
    exit 2
  fi
}

assert_http_ok() {
  local json="$1"; local key="$2"; local label="$3"
  if command -v jq >/dev/null 2>&1; then
    local val
    val=$(printf '%s' "$json" | jq -r "$key // empty")
    if [[ -z "$val" ]]; then
      echo "[ERR] Missing or empty field $key in $label response: $json" >&2
      exit 3
    fi
  fi
}

green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }

