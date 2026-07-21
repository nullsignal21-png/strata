# Strata Agent Guide

## Repository Map

- `src/app`: Next.js App Router pages and route handlers.
- `src/components`: Client and server UI components.
- `src/lib`: CSV ingestion, categorization, job matching, metrics, exports, env validation, logging, Prisma access, and demo seed logic.
- `prisma/schema.prisma`: PostgreSQL data model.
- `prisma/migrations`: Production migrations for `prisma migrate deploy`.
- `prisma/seed.ts`: Idempotent demo seed entrypoint.
- `src/tests`: Vitest unit/component tests and Playwright e2e specs.

## Local Checks

Run these after code changes:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Use `npm run test:e2e` only when `DATABASE_URL` and `DEMO_RESET_TOKEN` point at a disposable demo database.

## Database

Use migrations, not `db push`, for production:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Vercel builds run `npm run vercel-build`, which executes Prisma generate, migration deploy, and `next build`.
