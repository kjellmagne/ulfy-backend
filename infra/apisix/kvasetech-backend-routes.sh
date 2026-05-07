#!/usr/bin/env bash
set -euo pipefail

: "${APISIX_ADMIN_URL:=http://127.0.0.1:9180}"
: "${APISIX_ADMIN_KEY:?Set APISIX_ADMIN_KEY to your APISIX admin key}"

HOST="${KVASETECH_HOST:-${SKRIVDET_LEGACY_HOST:-${ULFY_HOST:-kvasetech.com}}}"
API_UPSTREAM="${SKRIVDET_API_UPSTREAM:-${ULFY_API_UPSTREAM:-192.168.222.171:4000}}"
ADMIN_UPSTREAM="${SKRIVDET_ADMIN_UPSTREAM:-${ULFY_ADMIN_UPSTREAM:-192.168.222.171:3300}}"
PUBLIC_PATH="${SKRIVDET_BACKEND_PUBLIC_PATH:-${ULFY_BACKEND_PUBLIC_PATH:-/backend}}"
PUBLIC_PATH="/${PUBLIC_PATH#/}"
PUBLIC_PATH="${PUBLIC_PATH%/}"

for route_id in kvasetech-backend-api kvasetech-backend-admin ulfy-backend-redirect ulfy-admin-root ulfy-api ulfy-admin skrivdet-api skrivdet-admin; do
  curl -fsS -X DELETE "${APISIX_ADMIN_URL}/apisix/admin/routes/${route_id}" \
    -H "X-API-KEY: ${APISIX_ADMIN_KEY}" >/dev/null || true
done

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/kvasetech-backend-api" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"kvasetech-backend-api\",
    \"host\": \"${HOST}\",
    \"uri\": \"${PUBLIC_PATH}/api/*\",
    \"priority\": 200,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^${PUBLIC_PATH}/(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${API_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/kvasetech-backend-admin" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"kvasetech-backend-admin\",
    \"host\": \"${HOST}\",
    \"uris\": [\"${PUBLIC_PATH}\", \"${PUBLIC_PATH}/*\"],
    \"priority\": 100,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^${PUBLIC_PATH}/?(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${ADMIN_UPSTREAM}\": 1
      }
    }
  }"

echo "Configured Kvasetech backend routes:"
echo "  https://${HOST}${PUBLIC_PATH}/api/* -> http://${API_UPSTREAM}/api/*"
echo "  https://${HOST}${PUBLIC_PATH}/*     -> http://${ADMIN_UPSTREAM}/*"
