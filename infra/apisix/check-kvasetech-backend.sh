#!/usr/bin/env bash
set -euo pipefail

HOST="${KVASETECH_HOST:-${SKRIVDET_LEGACY_HOST:-${ULFY_HOST:-kvasetech.com}}}"
PUBLIC_PATH="${SKRIVDET_BACKEND_PUBLIC_PATH:-${ULFY_BACKEND_PUBLIC_PATH:-/backend}}"
PUBLIC_PATH="/${PUBLIC_PATH#/}"
PUBLIC_PATH="${PUBLIC_PATH%/}"
BASE_URL="${KVASETECH_PUBLIC_BASE_URL:-${SKRIVDET_LEGACY_PUBLIC_BASE_URL:-${ULFY_PUBLIC_BASE_URL:-https://${HOST}${PUBLIC_PATH}}}}"
CANONICAL_BASE_URL="${SKRIVDET_CANONICAL_BASE_URL:-https://skrivdet.no${PUBLIC_PATH}}"
LEGACY_API_BASE_URL="${KVASETECH_API_BASE_URL:-https://${HOST}}"
DETAIL_PATH="${SKRIVDET_TEMPLATE_DETAIL_PATH:-${ULFY_TEMPLATE_DETAIL_PATH:-/templates/designer?familyId=00000000-0000-4000-8000-000000000304&variantId=00000000-0000-4000-8000-000000000404}}"

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

fetch_following_redirect() {
  local url="$1"
  local output="$2"
  local status

  status="$(curl -fsSL -o "${output}" -w "%{http_code}" "${url}")"
  if [ "${status}" != "200" ]; then
    echo "Expected 200 after following redirects from ${url}, got ${status}" >&2
    return 1
  fi
}

fetch_headers() {
  local url="$1"
  local output="$2"

  curl -sS -D "${output}" -o /dev/null "${url}" >/dev/null
}

assert_redirect() {
  local file="$1"
  local expected_location="$2"
  local label="$3"

  if ! grep -E '^HTTP/[0-9.]+ 308' "${file}" >/dev/null; then
    echo "${label} did not return HTTP 308 redirect:" >&2
    cat "${file}" >&2
    return 1
  fi

  if ! tr -d '\r' < "${file}" | grep -F "location: ${expected_location}" >/dev/null; then
    echo "${label} did not redirect to ${expected_location}:" >&2
    cat "${file}" >&2
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

assert_gateway_next_assets() {
  local file="$1"
  local label="$2"

  if ! grep -E "href=\"${PUBLIC_PATH}/_next|src=\"${PUBLIC_PATH}/_next" "${file}" >/dev/null; then
    echo "${label} does not contain ${PUBLIC_PATH}/_next assets. Admin basePath is not active." >&2
    return 1
  fi
}

LIST_HTML="${TMP_DIR}/templates.html"
DETAIL_HTML="${TMP_DIR}/template-detail.html"
LIST_HEADERS="${TMP_DIR}/templates.headers"
DETAIL_HEADERS="${TMP_DIR}/template-detail.headers"
LEGACY_HEALTH_JSON="${TMP_DIR}/legacy-health.json"
BACKEND_HEALTH_JSON="${TMP_DIR}/backend-health.json"

fetch_headers "${BASE_URL}/templates" "${LIST_HEADERS}"
fetch_headers "${BASE_URL}${DETAIL_PATH}" "${DETAIL_HEADERS}"
assert_redirect "${LIST_HEADERS}" "${CANONICAL_BASE_URL}/templates" "Legacy template list"
assert_redirect "${DETAIL_HEADERS}" "${CANONICAL_BASE_URL}${DETAIL_PATH}" "Legacy template designer"

fetch_following_redirect "${BASE_URL}/templates" "${LIST_HTML}"
fetch_following_redirect "${BASE_URL}${DETAIL_PATH}" "${DETAIL_HTML}"
fetch "${LEGACY_API_BASE_URL}/api/v1/health" "${LEGACY_HEALTH_JSON}"
fetch "${BASE_URL}/api/v1/health" "${BACKEND_HEALTH_JSON}"

assert_no_root_next_assets "${LIST_HTML}" "Template list"
assert_no_root_next_assets "${DETAIL_HTML}" "Template designer"
assert_gateway_next_assets "${LIST_HTML}" "Template list"
assert_gateway_next_assets "${DETAIL_HTML}" "Template designer"

if ! grep -F '"ok":true' "${LEGACY_HEALTH_JSON}" >/dev/null; then
  echo "Legacy API health did not return ok=true:" >&2
  cat "${LEGACY_HEALTH_JSON}" >&2
  exit 1
fi

if ! grep -F '"ok":true' "${BACKEND_HEALTH_JSON}" >/dev/null; then
  echo "Legacy backend API health did not return ok=true:" >&2
  cat "${BACKEND_HEALTH_JSON}" >&2
  exit 1
fi

echo "Kvasetech backend routing check passed for ${BASE_URL}"
