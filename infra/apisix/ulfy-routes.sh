#!/usr/bin/env bash
set -euo pipefail

: "${APISIX_ADMIN_URL:=http://127.0.0.1:9180}"
: "${APISIX_ADMIN_KEY:?Set APISIX_ADMIN_KEY to your APISIX admin key}"
: "${ULFY_HOST:?Set ULFY_HOST to the public hostname, for example ulfy.example.com}"
: "${ULFY_API_UPSTREAM:=127.0.0.1:4000}"
: "${ULFY_ADMIN_UPSTREAM:=127.0.0.1:3000}"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/ulfy-api" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"ulfy-api\",
    \"host\": \"${ULFY_HOST}\",
    \"uri\": \"/api/*\",
    \"priority\": 100,
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"pass_host\": \"pass\",
      \"nodes\": {
        \"${ULFY_API_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/ulfy-admin" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"ulfy-admin\",
    \"host\": \"${ULFY_HOST}\",
    \"uri\": \"/*\",
    \"priority\": 1,
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"pass_host\": \"pass\",
      \"nodes\": {
        \"${ULFY_ADMIN_UPSTREAM}\": 1
      }
    }
  }"

echo "Configured APISIX routes for https://${ULFY_HOST}"
