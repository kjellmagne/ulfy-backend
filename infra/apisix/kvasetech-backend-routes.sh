#!/usr/bin/env bash
set -euo pipefail

: "${APISIX_ADMIN_URL:=http://127.0.0.1:9180}"
: "${APISIX_ADMIN_KEY:?Set APISIX_ADMIN_KEY to your APISIX admin key}"

HOST="${ULFY_HOST:-kvasetech.com}"
API_UPSTREAM="${ULFY_API_UPSTREAM:-192.168.222.171:4000}"
ADMIN_UPSTREAM="${ULFY_ADMIN_UPSTREAM:-192.168.222.171:3300}"

curl -fsS -X DELETE "${APISIX_ADMIN_URL}/apisix/admin/routes/ulfy-backend-redirect" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" >/dev/null || true

curl -fsS -X DELETE "${APISIX_ADMIN_URL}/apisix/admin/routes/ulfy-admin-root" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" >/dev/null || true

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/ulfy-api" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"ulfy-api\",
    \"host\": \"${HOST}\",
    \"uri\": \"/backend/api/*\",
    \"priority\": 200,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^/backend/(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${API_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/ulfy-admin" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"ulfy-admin\",
    \"host\": \"${HOST}\",
    \"uris\": [\"/backend\", \"/backend/*\"],
    \"priority\": 100,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^/backend/?(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${ADMIN_UPSTREAM}\": 1
      }
    }
  }"

echo "Configured skrivDET routes:"
echo "  https://${HOST}/backend/api/* -> http://${API_UPSTREAM}/api/*"
echo "  https://${HOST}/backend/*     -> http://${ADMIN_UPSTREAM}/*"
