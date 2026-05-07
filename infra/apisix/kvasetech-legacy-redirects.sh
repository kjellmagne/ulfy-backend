#!/usr/bin/env bash
set -euo pipefail

: "${APISIX_ADMIN_URL:=http://127.0.0.1:9180}"
: "${APISIX_ADMIN_KEY:?Set APISIX_ADMIN_KEY to your APISIX admin key}"

LEGACY_HOST="${KVASETECH_LEGACY_HOST:-kvasetech.com}"
TARGET_ORIGIN="${SKRIVDET_TARGET_ORIGIN:-https://skrivdet.no}"
BACKEND_PATH="${SKRIVDET_BACKEND_PATH:-/backend}"
WEBSITE_PATH="${SKRIVDET_OLD_WEBSITE_PATH:-/skrivdet}"
ULFY_PATH="${SKRIVDET_OLD_ULFY_PATH:-/ulfy}"

BACKEND_PATH="/${BACKEND_PATH#/}"
BACKEND_PATH="${BACKEND_PATH%/}"
WEBSITE_PATH="/${WEBSITE_PATH#/}"
WEBSITE_PATH="${WEBSITE_PATH%/}"
ULFY_PATH="/${ULFY_PATH#/}"
ULFY_PATH="${ULFY_PATH%/}"
TARGET_ORIGIN="${TARGET_ORIGIN%/}"

for route_id in \
  ulfy-api \
  ulfy-admin \
  skrivdet-website \
  skrivdet-legacy-redirect \
  kvasetech-backend-redirect \
  kvasetech-skrivdet-redirect \
  kvasetech-ulfy-redirect; do
  curl -fsS -X DELETE "${APISIX_ADMIN_URL}/apisix/admin/routes/${route_id}" \
    -H "X-API-KEY: ${APISIX_ADMIN_KEY}" >/dev/null || true
done

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/kvasetech-backend-redirect" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"kvasetech-backend-redirect\",
    \"host\": \"${LEGACY_HOST}\",
    \"uri\": \"${BACKEND_PATH}*\",
    \"priority\": 500,
    \"plugins\": {
      \"redirect\": {
        \"regex_uri\": [\"^${BACKEND_PATH}/?(.*)\", \"${TARGET_ORIGIN}${BACKEND_PATH}/\$1\"],
        \"ret_code\": 308,
        \"append_query_string\": true
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/kvasetech-skrivdet-redirect" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"kvasetech-skrivdet-redirect\",
    \"host\": \"${LEGACY_HOST}\",
    \"uri\": \"${WEBSITE_PATH}*\",
    \"priority\": 400,
    \"plugins\": {
      \"redirect\": {
        \"regex_uri\": [\"^${WEBSITE_PATH}/?(.*)\", \"${TARGET_ORIGIN}/\$1\"],
        \"ret_code\": 308,
        \"append_query_string\": true
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/kvasetech-ulfy-redirect" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"kvasetech-ulfy-redirect\",
    \"host\": \"${LEGACY_HOST}\",
    \"uri\": \"${ULFY_PATH}*\",
    \"priority\": 400,
    \"plugins\": {
      \"redirect\": {
        \"regex_uri\": [\"^${ULFY_PATH}/?(.*)\", \"${TARGET_ORIGIN}/\$1\"],
        \"ret_code\": 308,
        \"append_query_string\": true
      }
    }
  }"

echo "Configured legacy Kvasetech redirects:"
echo "  https://${LEGACY_HOST}${BACKEND_PATH}* -> ${TARGET_ORIGIN}${BACKEND_PATH}*"
echo "  https://${LEGACY_HOST}${WEBSITE_PATH}* -> ${TARGET_ORIGIN}/*"
echo "  https://${LEGACY_HOST}${ULFY_PATH}* -> ${TARGET_ORIGIN}/*"
