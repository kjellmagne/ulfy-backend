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

Sample enterprise config response:

```json
{
  "success": true,
  "activationToken": "...",
  "tenant": { "id": "...", "name": "Acme Health", "slug": "acme-health" },
  "device": {
    "deviceIdentifier": "iphone-enterprise-1",
    "deviceSerialNumber": "C39XK123N72Q",
    "lastSeenAt": "2026-04-29T10:15:00.000Z"
  },
  "config": {
    "speechProviderType": "openai-compatible",
    "speechEndpointUrl": "https://speech.example.internal/v1/audio/transcriptions",
    "privacyControlEnabled": true,
    "piiControlEnabled": true,
    "templateRepositoryUrl": "http://localhost:4000/api/v1/templates/manifest",
    "featureFlags": { "enterpriseTemplates": true, "privacyReview": true },
    "allowedProviderRestrictions": ["openai-compatible", "internal"]
  }
}
```

Template manifest:

```bash
curl http://localhost:4000/api/v1/templates/manifest
```

Sample manifest response:

```json
{
  "name": "Ulfy Templates",
  "templates": [
    {
      "id": "00000000-0000-0000-0000-000000000201",
      "title": "Personlig diktat / logg",
      "short_description": "Kort beskrivelse",
      "category": "personlig_diktat",
      "language": "nb-NO",
      "version": "1.0.0",
      "icon": "waveform.and.mic",
      "tags": ["dictation", "personal"],
      "download_url": "/api/v1/templates/00000000-0000-0000-0000-000000000201/download",
      "updated_at": "2026-04-28T12:00:00.000Z"
    }
  ]
}
```

## Admin UI

The admin UI supports:

- Admin login
- Single-user key generation
- Enterprise key generation
- Enterprise customer/tenant registration
- Active unique-device license usage counts
- Activation inspection
- Single key revoke/reset
- Config profile creation and editing
- Template metadata and YAML editing
- YAML validation before save
- Template publish/archive
- Version history display
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
docker compose --env-file infra/.env.server -f infra/docker-compose.ghcr.yml up -d
docker compose --env-file infra/.env.server -f infra/docker-compose.ghcr.yml run --rm api pnpm prisma migrate deploy
docker compose --env-file infra/.env.server -f infra/docker-compose.ghcr.yml run --rm api pnpm prisma db seed
```

The Kvasetech/APISIX deployment serves Ulfy publicly at `https://kvasetech.com/backend/`. APISIX strips `/backend` before proxying to both upstream containers, so the API and admin services both run internally at `/`. The admin image still emits public `/backend/...` links and static asset URLs.

```bash
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d
APISIX_ADMIN_KEY='your-admin-key' bash infra/apisix/kvasetech-backend-routes.sh
```

Public API documentation is available through APISIX at:

- Swagger UI: `https://kvasetech.com/backend/api/docs`
- OpenAPI JSON: `https://kvasetech.com/backend/api/docs-json`

## GitHub Docker Images

GitHub Actions builds Docker images on pushes to `main`, version tags like `v1.0.0`, manual workflow runs, and pull requests. Pull requests build images for verification only. Pushes to `main` and tags publish images to GitHub Container Registry:

- `ghcr.io/kjellmagne/ulfy-backend-api:latest`
- `ghcr.io/kjellmagne/ulfy-backend-admin:latest`
- `ghcr.io/kjellmagne/ulfy-backend-api:sha-<commit>`
- `ghcr.io/kjellmagne/ulfy-backend-admin:sha-<commit>`

The admin image uses the GitHub Actions repository variable `NEXT_PUBLIC_API_BASE_URL` at build time. If the variable is not set, it defaults to `http://localhost:4000`.

Required deployment environment variables:

- `DATABASE_URL` for non-compose deployments
- `JWT_SECRET`
- `ACTIVATION_TOKEN_SECRET`
- `NEXT_PUBLIC_API_BASE_URL`

## v1 Simplifications

- Partner-admin scoping is represented in the model but not fully enforced on every admin list endpoint.
- Config profiles are manually managed JSON-backed records, without an advanced policy engine.
- Activation tokens are long-lived JWTs whose hashes are stored for lookup and revocation.
- Template schema validation is intentionally small and focused on the current Ulfy YAML shape.
