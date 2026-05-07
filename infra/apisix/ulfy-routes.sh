#!/usr/bin/env bash
set -euo pipefail

: "${APISIX_ADMIN_URL:=http://127.0.0.1:9180}"
: "${APISIX_ADMIN_KEY:?Set APISIX_ADMIN_KEY to your APISIX admin key}"

HOST="${SKRIVDET_HOST:-${ULFY_HOST:-}}"
API_UPSTREAM="${SKRIVDET_API_UPSTREAM:-${ULFY_API_UPSTREAM:-127.0.0.1:4000}}"
ADMIN_UPSTREAM="${SKRIVDET_ADMIN_UPSTREAM:-${ULFY_ADMIN_UPSTREAM:-127.0.0.1:3000}}"

if [ -z "${HOST}" ]; then
  echo "Set SKRIVDET_HOST (or legacy ULFY_HOST) to the public hostname, for example skrivdet.example.com" >&2
  exit 1
fi

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/ulfy-api" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"ulfy-api\",
    \"host\": \"${HOST}\",
    \"uri\": \"/api/*\",
    \"priority\": 100,
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"pass_host\": \"pass\",
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
    \"uri\": \"/*\",
    \"priority\": 1,
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"pass_host\": \"pass\",
      \"nodes\": {
        \"${ADMIN_UPSTREAM}\": 1
      }
    }
  }"

echo "Configured legacy single-host APISIX routes for https://${HOST}"
