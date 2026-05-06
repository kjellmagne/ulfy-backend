#!/usr/bin/env bash
set -euo pipefail

: "${APISIX_ADMIN_URL:=http://127.0.0.1:9180}"
: "${APISIX_ADMIN_KEY:?Set APISIX_ADMIN_KEY to your APISIX admin key}"

HOST="${ULFY_HOST:-kvasetech.com}"
WEBSITE_UPSTREAM="${SKRIVDET_WEBSITE_UPSTREAM:-192.168.222.171:8080}"
PUBLIC_PATH="${SKRIVDET_WEBSITE_PUBLIC_PATH:-/skrivdet}"
LEGACY_PATH="${SKRIVDET_WEBSITE_LEGACY_PATH:-/ulfy}"
PUBLIC_PATH="/${PUBLIC_PATH#/}"
PUBLIC_PATH="${PUBLIC_PATH%/}"
LEGACY_PATH="/${LEGACY_PATH#/}"
LEGACY_PATH="${LEGACY_PATH%/}"

for route_id in ulfy skrivdet-website skrivdet-legacy-redirect skrivdet-api skrivdet-admin; do
  curl -fsS -X DELETE "${APISIX_ADMIN_URL}/apisix/admin/routes/${route_id}" \
    -H "X-API-KEY: ${APISIX_ADMIN_KEY}" >/dev/null || true
done

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/skrivdet-website" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"skrivdet-website\",
    \"host\": \"${HOST}\",
    \"uris\": [\"${PUBLIC_PATH}\", \"${PUBLIC_PATH}/*\"],
    \"priority\": 50,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^${PUBLIC_PATH}/?(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${WEBSITE_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/skrivdet-legacy-redirect" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"skrivdet-legacy-redirect\",
    \"host\": \"${HOST}\",
    \"uri\": \"${LEGACY_PATH}*\",
    \"priority\": 300,
    \"plugins\": {
      \"redirect\": {
        \"regex_uri\": [\"^${LEGACY_PATH}/?(.*)\", \"${PUBLIC_PATH}/\$1\"],
        \"ret_code\": 308,
        \"append_query_string\": true
      }
    }
  }"

echo "Configured skrivDET website routes:"
echo "  https://${HOST}${PUBLIC_PATH}/* -> http://${WEBSITE_UPSTREAM}/*"
echo "  https://${HOST}${LEGACY_PATH}* redirects to https://${HOST}${PUBLIC_PATH}/*"
