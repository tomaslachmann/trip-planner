# Rosti Stack Deployment

Production deployment uses Rosti Stack with Traefik inside the user compose file.
Rosti exposes only one public HTTP port to the stack, so only the `traefik`
service maps `80:80`. The UI and API are private Docker services discovered by
Traefik labels.

## Routing

- `/` routes to the Next.js UI on internal port `3000`.
- `/api/*` routes to the Fastify API on internal port `3001`.
- Traefik strips `/api` before forwarding, so `/api/auth/sign-in` reaches the API
  as `/auth/sign-in`.
- `NEXT_PUBLIC_API_URL=/api` must be present at UI build time.
- `PUBLIC_API_URL=https://your-domain.example/api` should be set for API-generated
  upload URLs.

## Files

- `docker-compose.rosti.yml` - production compose for Rosti.
- `deploy/rosti.env.example` - copy into the Rosti `.env` editor and replace
  secrets/domains.
- `apps/api/Dockerfile.prod` - builds Fastify/Prisma API and runs migrations on
  container start.
- `apps/ui/Dockerfile.prod` - builds Next.js with `NEXT_PUBLIC_API_URL=/api`.
- `.github/workflows/images.yml` - builds and pushes API/UI images to GHCR.

## Rosti Compose

Paste `docker-compose.rosti.yml` into the Rosti Stack compose editor, or use it
as the deployment compose if deploying through CLI/CI.

The compose file expects prebuilt images:

```env
API_IMAGE=ghcr.io/tomaslachmann/trip-planner-api:latest
UI_IMAGE=ghcr.io/tomaslachmann/trip-planner-ui:latest
```

Images are produced by GitHub Actions on every push to `master`, on `v*` tags,
or manually via workflow dispatch.

Rosti keeps `/srv/stack/docker-compose.yml` managed from the administration UI,
so do not hand-edit it over SSH. Persistent data is stored through bind mounts:

- `./postgres-data:/var/lib/postgresql/data`
- `./uploads:/app/uploads`

## Required Environment

Start from:

```bash
cp deploy/rosti.env.example .env.rosti
```

Replace at least:

```env
API_IMAGE=ghcr.io/tomaslachmann/trip-planner-api:latest
UI_IMAGE=ghcr.io/tomaslachmann/trip-planner-ui:latest
POSTGRES_PASSWORD=...
JWT_SECRET=...
PUBLIC_API_URL=https://your-rosti-domain.example/api
NOMINATIM_USER_AGENT=trip-planner/0.1 (https://your-rosti-domain.example/contact)
WIKIMEDIA_USER_AGENT=trip-planner/0.1 (https://your-rosti-domain.example/contact)
OPENAI_API_KEY=...
```

Booking/RapidAPI credentials are optional, but accommodation search will not be
useful without them.

## Image Registry

The default CI publishes to GitHub Container Registry:

```txt
ghcr.io/tomaslachmann/trip-planner-api
ghcr.io/tomaslachmann/trip-planner-ui
```

Tags:

- `latest` on `master`
- `sha-<commit>` for every build
- `v*` tag names for release tags

For production, prefer pinning `API_IMAGE` and `UI_IMAGE` to the same immutable
`sha-<commit>` or release tag once the build is verified. `latest` is convenient
for fast iteration, but it makes rollbacks less explicit.

If GHCR packages stay private, configure registry access in Rosti for GHCR using
a GitHub token with `read:packages`. If the packages are public, no registry
credentials are needed.

## Local Validation

```bash
docker compose --env-file deploy/rosti.env.example -f docker-compose.rosti.yml config
docker build -t trip-planner-api:local -f apps/api/Dockerfile.prod apps/api
docker build -t trip-planner-ui:local -f apps/ui/Dockerfile.prod --build-arg NEXT_PUBLIC_API_URL=/api apps/ui
```

For local production smoke testing:

```bash
API_IMAGE=trip-planner-api:local UI_IMAGE=trip-planner-ui:local docker compose --env-file deploy/rosti.env.example -f docker-compose.rosti.yml up
```

Then open:

```txt
http://localhost
http://localhost/api/docs
```
