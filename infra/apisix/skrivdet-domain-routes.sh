#!/usr/bin/env bash
set -euo pipefail

: "${APISIX_ADMIN_URL:=http://127.0.0.1:9180}"
: "${APISIX_ADMIN_KEY:?Set APISIX_ADMIN_KEY to your APISIX admin key}"

HOSTS="${SKRIVDET_HOSTS:-skrivdet.no,www.skrivdet.no}"
API_HOSTS="${SKRIVDET_API_HOSTS:-api.skrivdet.no}"
API_UPSTREAM="${SKRIVDET_API_UPSTREAM:-${ULFY_API_UPSTREAM:-192.168.222.171:4000}}"
ADMIN_UPSTREAM="${SKRIVDET_ADMIN_UPSTREAM:-${ULFY_ADMIN_UPSTREAM:-192.168.222.171:3300}}"
WEBSITE_UPSTREAM="${SKRIVDET_WEBSITE_UPSTREAM:-192.168.222.171:8080}"
BACKEND_PATH="${SKRIVDET_BACKEND_PATH:-/backend}"
BACKEND_PATH="/${BACKEND_PATH#/}"
BACKEND_PATH="${BACKEND_PATH%/}"

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

HOSTS_JSON="$(json_array_from_csv "${HOSTS}")"
API_HOSTS_JSON="$(json_array_from_csv "${API_HOSTS}")"

for route_id in skrivdet-api-host skrivdet-no-api skrivdet-no-admin skrivdet-no-website-prefixed-assets skrivdet-no-website; do
  curl -fsS -X DELETE "${APISIX_ADMIN_URL}/apisix/admin/routes/${route_id}" \
    -H "X-API-KEY: ${APISIX_ADMIN_KEY}" >/dev/null || true
done

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/skrivdet-api-host" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"skrivdet-api-host\",
    \"hosts\": ${API_HOSTS_JSON},
    \"uri\": \"/api/*\",
    \"priority\": 300,
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${API_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/skrivdet-no-api" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"skrivdet-no-api\",
    \"hosts\": ${HOSTS_JSON},
    \"uri\": \"${BACKEND_PATH}/api/*\",
    \"priority\": 200,
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

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/skrivdet-no-admin" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"skrivdet-no-admin\",
    \"hosts\": ${HOSTS_JSON},
    \"uris\": [\"${BACKEND_PATH}\", \"${BACKEND_PATH}/*\"],
    \"priority\": 100,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^${BACKEND_PATH}/?(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${ADMIN_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/skrivdet-no-website-prefixed-assets" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"skrivdet-no-website-prefixed-assets\",
    \"hosts\": ${HOSTS_JSON},
    \"uri\": \"/skrivdet/assets/*\",
    \"priority\": 80,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^/skrivdet/(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${WEBSITE_UPSTREAM}\": 1
      }
    }
  }"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/skrivdet-no-website" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"skrivdet-no-website\",
    \"hosts\": ${HOSTS_JSON},
    \"uris\": [\"/\", \"/*\"],
    \"priority\": 10,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^/(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${WEBSITE_UPSTREAM}\": 1
      }
    }
  }"

echo "Configured skrivDET domain routes for ${HOSTS}:"
echo "  https://api.skrivdet.no/api/* -> http://${API_UPSTREAM}/api/*"
echo "  https://skrivdet.no/         -> http://${WEBSITE_UPSTREAM}/"
echo "  https://skrivdet.no/backend  -> http://${ADMIN_UPSTREAM}/"
echo "  https://skrivdet.no/backend/api/* -> http://${API_UPSTREAM}/api/*"
