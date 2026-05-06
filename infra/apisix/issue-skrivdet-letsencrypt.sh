#!/usr/bin/env bash
set -euo pipefail

: "${APISIX_ADMIN_URL:=http://127.0.0.1:9180}"
: "${APISIX_ADMIN_KEY:?Set APISIX_ADMIN_KEY to your APISIX admin key}"

DOMAINS="${SKRIVDET_CERT_DOMAINS:-skrivdet.no,www.skrivdet.no}"
WEBROOT="${SKRIVDET_CERT_WEBROOT:-/var/www/letsencrypt}"
ACME_UPSTREAM="${SKRIVDET_ACME_UPSTREAM:-192.168.222.171:8088}"
ACME_BIND="${SKRIVDET_ACME_BIND:-0.0.0.0}"
ACME_PORT="${SKRIVDET_ACME_PORT:-8088}"
SSL_ID="${SKRIVDET_SSL_ID:-skrivdet-no}"

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

certbot_domain_args() {
  local csv="$1"
  local item

  while IFS= read -r item; do
    item="$(printf '%s' "${item}" | xargs)"
    [ -n "${item}" ] || continue
    printf -- '-d %s ' "${item}"
  done <<EOF
$(printf '%s' "${csv}" | tr ',' '\n')
EOF
}

primary_domain="$(printf '%s' "${DOMAINS}" | cut -d, -f1 | xargs)"
hosts_json="$(json_array_from_csv "${DOMAINS}")"
domain_args="$(certbot_domain_args "${DOMAINS}")"
email_args="--register-unsafely-without-email"
if [ -n "${LETSENCRYPT_EMAIL:-}" ]; then
  email_args="--email ${LETSENCRYPT_EMAIL}"
fi

mkdir -p "${WEBROOT}"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/routes/skrivdet-acme-http01" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"skrivdet-acme-http01\",
    \"hosts\": ${hosts_json},
    \"uri\": \"/.well-known/acme-challenge/*\",
    \"priority\": 1000,
    \"plugins\": {
      \"proxy-rewrite\": {
        \"regex_uri\": [\"^/.well-known/acme-challenge/(.*)\", \"/\$1\"]
      }
    },
    \"upstream\": {
      \"type\": \"roundrobin\",
      \"nodes\": {
        \"${ACME_UPSTREAM}\": 1
      }
    }
  }" >/dev/null

python3 -m http.server "${ACME_PORT}" --bind "${ACME_BIND}" --directory "${WEBROOT}" >/tmp/skrivdet-acme-http.log 2>&1 &
server_pid="$!"
trap 'kill "${server_pid}" >/dev/null 2>&1 || true' EXIT
sleep 1

# shellcheck disable=SC2086
certbot certonly --webroot -w "${WEBROOT}" ${domain_args} \
  --non-interactive --agree-tos ${email_args} --keep-until-expiring

cert_path="/etc/letsencrypt/live/${primary_domain}/fullchain.pem"
key_path="/etc/letsencrypt/live/${primary_domain}/privkey.pem"

cert_json="$(jq -Rs . < "${cert_path}")"
key_json="$(jq -Rs . < "${key_path}")"

curl -fsS -X PUT "${APISIX_ADMIN_URL}/apisix/admin/ssls/${SSL_ID}" \
  -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"snis\": ${hosts_json},
    \"cert\": ${cert_json},
    \"key\": ${key_json}
  }" >/dev/null

echo "Installed Let's Encrypt certificate ${SSL_ID} for ${DOMAINS} in APISIX."
