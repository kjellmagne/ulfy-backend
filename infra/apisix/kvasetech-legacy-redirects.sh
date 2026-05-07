#!/usr/bin/env bash
set -euo pipefail

: "${APISIX_ADMIN_URL:=http://127.0.0.1:9180}"
: "${APISIX_ADMIN_KEY:?Set APISIX_ADMIN_KEY to your APISIX admin key}"

LEGACY_HOST="${KVASETECH_LEGACY_HOST:-kvasetech.com}"
LEGACY_HOSTS="${KVASETECH_LEGACY_HOSTS:-${LEGACY_HOST}}"
TARGET_ORIGIN="${SKRIVDET_TARGET_ORIGIN:-https://skrivdet.no}"
API_UPSTREAM="${ULFY_API_UPSTREAM:-192.168.222.171:4000}"
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

json_array_from_csv() {
  local csv="$1"
  local first=1
  local item

  printf '['
  while IFS= read -r item; do
    item="$(printf '%s' "${item}" | xargs)"
    [ -n "${item}" ] || continue
    if [ "${first}" -eq 0 ]; then
      printf ','
    fi
    first=0
    printf '"%s"' "${item}"
  done <<EOF
$(printf '%s' "${csv}" | tr ',' '\n')
EOF
  printf ']'
}

LEGACY_HOSTS_JSON="$(json_array_from_csv "${LEGACY_HOSTS}")"

for route_id in \
  ulfy-api \
  ulfy-admin \
  skrivdet-website \
  skrivdet-legacy-redirect \
  kvasetech-api-compat \
  kvasetech-backend-api-compat \
  kvasetech-skrivdet-api-compat \
  kvasetech-ulfy-api-compat \
  kvasetech-backend-redirect \
  kvasetech-skrivdet-redirect \
  kvasetech-ulfy-redirect; do
  curl -fsS -X DELETE "${APISIX_ADMIN_URL}/apisix/admin/routes/${route_id}" \
    -H "X-API-KEY: ${APISIX_ADMIN_KEY}" >/dev/null || true
done

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/kvasetech-api-compat" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"kvasetech-api-compat\",
    \"hosts\": ${LEGACY_HOSTS_JSON},
    \"uri\": \"/api/*\",
    \"priority\": 800,
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${API_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/kvasetech-backend-api-compat" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"kvasetech-backend-api-compat\",
    \"hosts\": ${LEGACY_HOSTS_JSON},
    \"uri\": \"${BACKEND_PATH}/api/*\",
    \"priority\": 750,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^${BACKEND_PATH}/(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${API_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/kvasetech-skrivdet-api-compat" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"kvasetech-skrivdet-api-compat\",
    \"hosts\": ${LEGACY_HOSTS_JSON},
    \"uri\": \"${WEBSITE_PATH}/api/*\",
    \"priority\": 750,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^${WEBSITE_PATH}/(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${API_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/kvasetech-ulfy-api-compat" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"kvasetech-ulfy-api-compat\",
    \"hosts\": ${LEGACY_HOSTS_JSON},
    \"uri\": \"${ULFY_PATH}/api/*\",
    \"priority\": 750,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^${ULFY_PATH}/(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${API_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/kvasetech-backend-redirect" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"kvasetech-backend-redirect\",
    \"hosts\": ${LEGACY_HOSTS_JSON},
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
    \"hosts\": ${LEGACY_HOSTS_JSON},
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
    \"hosts\": ${LEGACY_HOSTS_JSON},
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
echo "  https://${LEGACY_HOSTS}/api/* -> http://${API_UPSTREAM}/api/*"
echo "  https://${LEGACY_HOSTS}${BACKEND_PATH}/api/* -> http://${API_UPSTREAM}/api/*"
echo "  https://${LEGACY_HOSTS}${WEBSITE_PATH}/api/* -> http://${API_UPSTREAM}/api/*"
echo "  https://${LEGACY_HOSTS}${ULFY_PATH}/api/* -> http://${API_UPSTREAM}/api/*"
echo "  https://${LEGACY_HOSTS}${BACKEND_PATH}* -> ${TARGET_ORIGIN}${BACKEND_PATH}*"
echo "  https://${LEGACY_HOSTS}${WEBSITE_PATH}* -> ${TARGET_ORIGIN}/*"
echo "  https://${LEGACY_HOSTS}${ULFY_PATH}* -> ${TARGET_ORIGIN}/*"
