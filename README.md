# Trip Planner

Collaborative trip planner with shared map planning, group voting, accommodation shortlisting, shared expenses, settlements, and QR payments.

## Stack

- Node.js
- TypeScript
- Fastify
- Prisma
- PostgreSQL
- Zod

## Structure

```txt
apps/api     Node.js API

docs         Product and technical notes
```

## Run API

```bash
cd apps/api
cp .env.example .env
npm install
npm run prisma:generate
npm run dev
```

API documentation is available at:

```txt
http://localhost:3001/docs
```

The raw OpenAPI contract is generated to `apps/api/openapi.json`.

## Generated API client

Generate the OpenAPI contract and typed TypeScript client:

```bash
cd apps/api
npm run client:generate
```

The generated client entrypoint is:

```ts
import { createTripPlannerClient } from './src/generated/client.js';

const api = createTripPlannerClient('http://localhost:3001', accessToken);
```

## Run UI

```bash
cd apps/ui
cp .env.example .env
npm install
npm run client:generate
npm run dev
```

The UI runs at:

```txt
http://localhost:3000
```

It reads the API URL from `NEXT_PUBLIC_API_URL`. The UI signs in through
`/auth/sign-in` and sends protected API calls with a Bearer JWT.

## Booking accommodation search

The accommodation flow goes through the API, not directly from the browser to Booking:

```txt
UI -> /accommodations/search -> RapidAPI Booking provider
UI -> /accommodations/save -> saved as ACCOMMODATION place
```

Local development does not fall back to fake hotels. Set RapidAPI credentials in
the root `.env` used by Docker Compose:

```bash
BOOKING_PROVIDER=rapidapi
BOOKING_RAPIDAPI_BASE_URL="https://booking-com15.p.rapidapi.com"
BOOKING_RAPIDAPI_HOST="booking-com15.p.rapidapi.com"
RAPIDAPI_KEY="..."
```

## Routing, transit, weather, and map discovery

Driving/walking/bike routes use OSRM by default. Public transport is not free as
a single global hosted API in the same way Google Maps is. The open/free path is
to run OpenTripPlanner with OpenStreetMap plus GTFS feeds for the target region,
then configure:

```bash
TRANSIT_PROVIDER=otp
TRANSIT_OTP_BASE_URL="http://your-otp-host:8080"
```

Without that, `/routes/capabilities` reports `TRANSIT: false` and the API will
reject transit route creation instead of returning fake routes. Location search
uses Nominatim, map discovery uses Overpass, and forecast data uses Open-Meteo.

## Database

```bash
npm run prisma:migrate
```

For quick local DB:

```bash
docker compose up -d
```

## Rosti deployment

Production stack files for Rosti hosting live in [docs/rosti-deploy.md](docs/rosti-deploy.md).
The deployment uses GHCR images, `docker-compose.rosti.yml`, Traefik on the only
public port `80`, Next.js on `/`, and the API under `/api`.
