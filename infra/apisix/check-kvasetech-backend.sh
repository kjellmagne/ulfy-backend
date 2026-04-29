#!/usr/bin/env bash
set -euo pipefail

HOST="${ULFY_HOST:-kvasetech.com}"
BASE_URL="${ULFY_PUBLIC_BASE_URL:-https://${HOST}/backend}"
DETAIL_PATH="${ULFY_TEMPLATE_DETAIL_PATH:-/templates/designer?familyId=00000000-0000-4000-8000-000000000304&variantId=00000000-0000-4000-8000-000000000404}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

fetch() {
  local url="$1"
  local output="$2"
  local status

  status="$(curl -fsS -o "${output}" -w "%{http_code}" "${url}")"
  if [ "${status}" != "200" ]; then
    echo "Expected 200 from ${url}, got ${status}" >&2
    return 1
  fi
}

assert_no_root_next_assets() {
  local file="$1"
  local label="$2"

  if grep -E 'href="/_next|src="/_next' "${file}" >/dev/null; then
    echo "${label} contains root /_next asset references. Admin basePath build or APISIX routing is wrong." >&2
    grep -Eo 'href="/_next[^"]+|src="/_next[^"]+' "${file}" >&2 || true
    return 1
  fi
}

assert_backend_next_assets() {
  local file="$1"
  local label="$2"

  if ! grep -E 'href="/backend/_next|src="/backend/_next' "${file}" >/dev/null; then
    echo "${label} does not contain /backend/_next assets. Admin basePath is not active." >&2
    return 1
  fi
}

LIST_HTML="${TMP_DIR}/templates.html"
DETAIL_HTML="${TMP_DIR}/template-detail.html"
HEALTH_JSON="${TMP_DIR}/health.json"

fetch "${BASE_URL}/templates" "${LIST_HTML}"
fetch "${BASE_URL}${DETAIL_PATH}" "${DETAIL_HTML}"
fetch "${BASE_URL}/api/v1/health" "${HEALTH_JSON}"

assert_no_root_next_assets "${LIST_HTML}" "Template list"
assert_no_root_next_assets "${DETAIL_HTML}" "Template designer"
assert_backend_next_assets "${LIST_HTML}" "Template list"
assert_backend_next_assets "${DETAIL_HTML}" "Template designer"

if ! grep -F '"ok":true' "${HEALTH_JSON}" >/dev/null; then
  echo "API health did not return ok=true:" >&2
  cat "${HEALTH_JSON}" >&2
  exit 1
fi

echo "Ulfy backend routing check passed for ${BASE_URL}"
