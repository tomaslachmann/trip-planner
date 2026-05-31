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

## Database

```bash
npm run prisma:migrate
```

For quick local DB:

```bash
docker compose up -d
```
