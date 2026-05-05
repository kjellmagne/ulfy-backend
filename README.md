# Ulfy Backend

Internal/admin-controlled backend monorepo for Ulfy licensing, enterprise configuration, and YAML template management.

## Local Development

Docker is not required for daily development. Run PostgreSQL locally on your machine and point `DATABASE_URL` at it.

Required tools:

- Node.js 22+
- pnpm via Corepack: `corepack enable`
- PostgreSQL 15+

Setup:

```bash
cd /Users/kjellmagnegabrielsen/ulfy-backend
cp .env.example .env
pnpm install
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev:api
```

In another terminal:

```bash
cd /Users/kjellmagnegabrielsen/ulfy-backend
pnpm dev:admin
```

Default local URLs:

- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/docs-json`
- Admin UI: `http://localhost:3000`

Seed admin user:

- Email: `admin@ulfy.local`
- Password: `ChangeMe123!`

To choose a different first admin password during seeding:

```bash
SEED_ADMIN_PASSWORD='YourStrongPassword123!' pnpm prisma:seed
```

Useful scripts:

```bash
pnpm dev:api
pnpm dev:admin
pnpm build
pnpm lint
pnpm test
pnpm prisma:migrate
pnpm prisma:seed
```

## API Examples

Single activation:

```bash
curl -X POST http://localhost:4000/api/v1/activate/single \
  -H 'Content-Type: application/json' \
  -d '{"activationKey":"ULFY-S-...","deviceIdentifier":"iphone-abc","deviceSerialNumber":"C39XK123N72Q","appVersion":"1.0.0"}'
```

Enterprise activation:

```bash
curl -X POST http://localhost:4000/api/v1/activate/enterprise \
  -H 'Content-Type: application/json' \
  -d '{"activationKey":"ULFY-E-...","deviceIdentifier":"iphone-enterprise-1","deviceSerialNumber":"C39XK123N72Q","appVersion":"1.0.0"}'
```

License refresh/check-in:

```bash
curl -X POST http://localhost:4000/api/v1/activation/refresh \
  -H 'Content-Type: application/json' \
  -d '{"activationToken":"...","deviceIdentifier":"iphone-enterprise-1","deviceSerialNumber":"C39XK123N72Q","appVersion":"1.0.1"}'
```

`deviceIdentifier` is the stable value used for license binding and unique-device counts. `deviceSerialNumber` is stored for admin support/audit when the app or MDM environment can provide it. Each activation and refresh updates `lastSeenAt` on the device activation record.

Dedicated license details:

```bash
curl 'http://localhost:4000/api/v1/license/details?activationToken=...'
```

Effective config with license metadata:

```bash
curl 'http://localhost:4000/api/v1/config/effective?activationToken=...'
```

Mobile-facing errors use this shape:

```json
{
  "success": false,
  "error": {
    "code": "activation_key_invalid",
    "message": "Activation key not found"
  }
}
```

Sample enterprise activation payload:

```json
{
  "success": true,
  "activationToken": "...",
  "activationId": "...",
  "license": {
    "type": "enterprise",
    "status": "active",
    "registeredToName": "Acme Health AS",
    "registeredToEmail": "kari@acme-health.example",
    "activatedAt": "2026-04-29T10:15:00.000Z",
    "maintenanceActive": true,
    "maintenanceUntil": "2027-04-29T00:00:00.000Z"
  },
  "tenant": { "id": "...", "name": "Acme Health", "slug": "acme-health" },
  "device": {
    "deviceIdentifier": "iphone-enterprise-1",
    "deviceSerialNumber": "C39XK123N72Q",
    "lastSeenAt": "2026-04-29T10:15:00.000Z"
  },
  "config": {
    "id": "00000000-0000-0000-0000-000000000101",
    "name": "Default Enterprise Profile",
    "speechProviderType": "azure",
    "speechEndpointUrl": "https://kvasetech.com/stt",
    "speechApiKey": "optional-managed-speech-key",
    "privacyControlEnabled": true,
    "piiControlEnabled": true,
    "documentGenerationProviderType": "openai_compatible",
    "documentGenerationEndpointUrl": "https://kvasetech.com/ollama",
    "documentGenerationApiKey": "optional-managed-docgen-key",
    "templateRepositoryUrl": "http://localhost:4000/api/v1/templates/manifest",
    "featureFlags": { "developerMode": false, "allowExternalProviders": false },
    "allowedProviderRestrictions": ["azure", "openai_compatible", "local_heuristic"],
    "managedPolicy": {
      "managePrivacyControl": true,
      "userMayChangePrivacyControl": false,
      "managePIIControl": true,
      "userMayChangePIIControl": false,
      "managePrivacyReviewProvider": true,
      "userMayChangePrivacyReviewProvider": false,
      "managePrivacyPrompt": false,
      "manageTemplateCategories": true
    }
  }
}
```

Template manifest:

```bash
curl http://localhost:4000/api/v1/templates/manifest \
  -H "Authorization: Bearer <enterprise-activation-token>"
```

Sample manifest response:

```json
{
  "name": "Enterprise Templates",
  "templates": [
    {
      "id": "00000000-0000-4000-8000-000000000201",
      "title": "Personlig diktat / logg",
      "short_description": "Kort strukturert logg fra personlig diktat.",
      "category": "personlig_diktat",
      "language": "nb-NO",
      "version": "1.0.0",
      "icon": "waveform.and.mic",
      "tags": ["dictation", "personal"],
      "download_url": "/api/v1/templates/00000000-0000-4000-8000-000000000201/download",
      "updated_at": "2026-04-29T12:00:00.000Z"
    }
  ]
}
```

Single-user activations are intentionally blocked from the central repository. Enterprise catalog and download calls are filtered by the tenant tied to the activation token. Internal/dev override access can be enabled with `TEMPLATE_REPOSITORY_API_KEY`.

Config profiles keep provider domains separate:

- Speech: `local`, `apple_online`, `openai`, `azure`, `gemini`
- Document generation / formatter: `apple_intelligence`, `openai`, `ollama`, `openai_compatible`, `gemini`, `claude`
- Privacy review / guardrail: `local_heuristic`, `ollama`, `openai_compatible` are the recommended v1 choices
- Presidio PII is configured separately from privacy review
- Optional managed provider credentials are `speechApiKey` and `documentGenerationApiKey`. Prefer internal gateway endpoints or tenant-scoped keys when these fields are sent to mobile devices.
- The admin UI defaults Azure Speech to `https://kvasetech.com/stt`, Ollama/OpenAI-compatible formatter endpoints to `https://kvasetech.com/ollama`, and OpenAI formatter to `https://api.openai.com/v1` with `gpt-5-mini`. Ollama and OpenAI-compatible models are intentionally left blank until selected from the fetched model list or typed manually.

Leave provider fields blank when the backend should not manage that setting for the tenant.

Admin config/policy endpoints require a bearer token from `/api/v1/auth/login`.

Clone an existing policy/config profile:

```bash
TOKEN='admin-jwt-from-login'

curl -X POST http://localhost:4000/api/v1/admin/config-profiles/<config-profile-id>/clone \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Copy of Strict enterprise policy"}'
```

The clone endpoint copies managed provider fields, API keys, privacy settings, repository settings, feature flags, provider profile metadata, and managed policy switches. It does not copy tenants or enterprise keys that reference the original policy.

List live provider models while editing a policy:

```bash
curl -X POST http://localhost:4000/api/v1/admin/provider-models \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "providerDomain": "document_generation",
    "providerType": "openai_compatible",
    "endpointUrl": "https://kvasetech.com/ollama",
    "apiKey": "provider-or-gateway-key"
  }'
```

Sample model lookup response:

```json
{
  "success": true,
  "providerType": "openai_compatible",
  "models": [
    { "id": "ulfy-docgen", "name": "ulfy-docgen" }
  ]
}
```

Model lookup support:

- `openai` and `openai_compatible` use an OpenAI-compatible `/models` endpoint.
- `ollama` uses `/api/tags`.
- `gemini` uses the Google model-list endpoint.
- `claude` uses the Anthropic model-list endpoint.
- `local`, `apple_online`, `apple_intelligence`, `local_heuristic`, and Azure Speech do not expose useful remote model lists in v1.

## Admin UI

The admin UI supports:

- Admin login
- Current logged-in user display and logout
- Superadmin user management for staff and partner admins
- Solution partner management
- Single-user key generation
- Enterprise key generation
- Maintenance/support expiry dates on generated keys
- Enterprise customer/tenant registration
- Active unique-device license usage counts
- Activation inspection
- Single and enterprise key revoke/reactivate/delete flows
- Enterprise device activation inspection and deletion
- Config profile creation, editing, deletion, and cloning
- Provider model lookup directly from the policy editor
- Policy editing with speech, formatter, Presidio PII, and privacy review kept as separate provider domains
- Optional managed provider API keys for speech and document generation formatter
- Template family, language-variant and YAML draft editing
- Template category and reusable section-preset settings
- SF Symbol-style icon picker for templates
- Tenant entitlement assignment for enterprise repository access
- YAML validation before save and publish
- Admin-chosen semver publish flow with immutable version history
- Manual AI preview generation from a saved draft and sample transcript
- Audit log listing

There are no public signup, billing, self-service onboarding, or tenant portal routes.

## Docker Deployment

Docker is included for deployment, pull-down setup, server packaging, and production-like verification. It is not the primary local development path.

```bash
cd /Users/kjellmagnegabrielsen/ulfy-backend
cp infra/.env.example infra/.env
docker compose --env-file infra/.env -f infra/docker-compose.yml build
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
```

Run migrations and seed inside the deployment stack:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml run --rm api pnpm prisma migrate deploy
docker compose --env-file infra/.env -f infra/docker-compose.yml run --rm api pnpm prisma db seed
```

For an Ubuntu server behind APISIX, use the server compose file instead. It keeps Postgres private and only binds API/admin to localhost:

```bash
cp infra/.env.server.example infra/.env.server
docker compose --env-file infra/.env.server -f infra/docker-compose.server.yml build
docker compose --env-file infra/.env.server -f infra/docker-compose.server.yml up -d
docker compose --env-file infra/.env.server -f infra/docker-compose.server.yml run --rm api pnpm prisma migrate deploy
docker compose --env-file infra/.env.server -f infra/docker-compose.server.yml run --rm api pnpm prisma db seed
```

APISIX can route the same public HTTPS hostname to both services:

```bash
APISIX_ADMIN_KEY='your-admin-key' \
ULFY_HOST='ulfy.example.com' \
bash infra/apisix/ulfy-routes.sh
```

To pull prebuilt app images from GitHub Container Registry instead of building on the server, use:

```bash
cp infra/.env.server.example infra/.env.server
sudo mkdir -p /opt/ulfy-data/postgres
sudo chown -R "$USER:$USER" /opt/ulfy-data
docker compose --env-file infra/.env.server -f infra/docker-compose.ghcr.yml pull
docker compose --env-file infra/.env.server -f infra/docker-compose.ghcr.yml up -d postgres
docker compose --env-file infra/.env.server -f infra/docker-compose.ghcr.yml run --rm api pnpm prisma migrate deploy
docker compose --env-file infra/.env.server -f infra/docker-compose.ghcr.yml run --rm api pnpm prisma db seed
docker compose --env-file infra/.env.server -f infra/docker-compose.ghcr.yml up -d api admin
```

Important: after pulling a new API image, run `pnpm prisma migrate deploy` before relying on the admin UI. If the image expects a newer Prisma schema than the database, admin list endpoints can fail with Prisma `P2022` missing-column errors.

On older Ubuntu hosts using legacy `docker-compose` 1.x, container recreation may fail after image updates. A safe pull/recreate sequence is:

```bash
cd /opt/ulfy
sudo docker-compose pull api admin
sudo docker-compose run --rm -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 api pnpm prisma migrate deploy
sudo docker rm -f ulfy_api_1 ulfy_admin_1
sudo docker-compose up -d --no-deps api admin
```

The Kvasetech/APISIX deployment serves Ulfy publicly at `https://kvasetech.com/backend/`.

Important routing rule:

- API route: `/backend/api/*` is proxied to the API after stripping `/backend`, so the API receives `/api/*`.
- Admin route: `/backend` and `/backend/*` is proxied to the admin after stripping `/backend`, so Next.js receives `/`, `/templates`, and `/_next/*`. The admin image uses `NEXT_PUBLIC_BASE_PATH=/backend` as an asset/link prefix, not as a Next.js `basePath`.

```bash
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d postgres
docker compose --env-file .env -f docker-compose.yml run --rm api pnpm prisma migrate deploy
docker compose --env-file .env -f docker-compose.yml run --rm api pnpm prisma db seed
docker compose --env-file .env -f docker-compose.yml up -d api admin
APISIX_ADMIN_KEY='your-admin-key' bash infra/apisix/kvasetech-backend-routes.sh
```

Verify the deployed routing after pulling a new admin image:

```bash
bash infra/apisix/check-kvasetech-backend.sh
```

This check fails if either the template list or the full template designer route serves root `/_next/...` assets instead of `/backend/_next/...`.

Public API documentation is available through APISIX at:

- Swagger UI: `https://kvasetech.com/backend/api/docs`
- OpenAPI JSON: `https://kvasetech.com/backend/api/docs-json`

## GitHub Docker Images

GitHub Actions builds Docker images on pushes to `main`, version tags like `v1.0.0`, manual workflow runs, and pull requests. Pull requests build images for verification only. Pushes to `main` and tags publish images to GitHub Container Registry:

- `ghcr.io/kjellmagne/ulfy-backend-api:latest`
- `ghcr.io/kjellmagne/ulfy-backend-admin:latest`
- `ghcr.io/kjellmagne/ulfy-backend-api:sha-<commit>`
- `ghcr.io/kjellmagne/ulfy-backend-admin:sha-<commit>`

The GitHub admin image is built for the APISIX `/backend` mount by default. It uses `NEXT_PUBLIC_BASE_PATH=/backend` at build time for public links and `_next` asset URLs, while APISIX strips `/backend` before forwarding admin requests to Next.js. It leaves `NEXT_PUBLIC_API_BASE_URL` empty, so browser requests go to the same public origin as `/backend/api/v1/...`. If you set `NEXT_PUBLIC_API_BASE_URL`, include the complete public API prefix, for example `https://kvasetech.com/backend`.

Required deployment environment variables:

- `DATABASE_URL` for non-compose deployments
- `JWT_SECRET`
- `ACTIVATION_TOKEN_SECRET`
- `PUBLIC_BASE_PATH` when serving the admin under a gateway prefix such as `/backend`
- AI preview provider is normally configured in the admin portal under `Settings` by a superadmin. `TEMPLATE_PREVIEW_ENDPOINT_URL`, `TEMPLATE_PREVIEW_API_KEY`, and `TEMPLATE_PREVIEW_MODEL` remain optional deployment fallbacks.
- optional `TEMPLATE_REPOSITORY_API_KEY` for internal repository override access

## v1 Simplifications

- Partner-admin scoping is represented in the model but not fully enforced on every admin list endpoint.
- Config profiles are manually managed JSON-backed records, without an advanced policy engine.
- Activation tokens are long-lived JWTs whose hashes are stored for lookup and revocation.
- The mobile app still owns local template forking/update behavior; the backend provides the authoritative published repository, tenant filtering, history, and preview tooling.
- AI preview uses one centrally configured OpenAI-compatible preview provider/model. It is managed by superadmins in Settings, with environment variables kept as deployment fallbacks.
