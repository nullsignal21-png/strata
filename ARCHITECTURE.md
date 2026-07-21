# Strata Architecture

Strata is a modular monolith: one Next.js application deployed to Vercel, with modules split by business capability.

## Runtime Flow

Browser requests are served by Vercel CDN and Next.js App Router pages. Mutations and exports go through Next.js Route Handlers running on the Node.js runtime. Route handlers use Prisma ORM against PostgreSQL, intended to be Prisma Postgres from the Vercel Marketplace.

## Modules

- CSV ingestion: `src/lib/csv.ts`, `src/app/api/upload/route.ts`
- Categorization: `src/lib/categorization.ts`, `src/lib/openai.ts`
- Job matching: `src/lib/jobMatcher.ts`
- Profitability and reports: `src/lib/metrics.ts`, `src/lib/profitability.ts`
- Exports: `src/lib/exports.ts`, `src/app/api/export/route.ts`
- Demo data: `src/lib/demoData.ts`, `prisma/seed.ts`, `src/app/api/demo/reset/route.ts`
- Integrations: `src/lib/quickbooks.ts`, `src/app/api/quickbooks/*`

## Money Rules

Transactions store positive `amount` values. `direction` is the source of truth for income versus expense. Job costs include only expense transactions assigned to a job. Job revenue is `Job.actualRevenue`. Imported income is shown as cash collected and is not added to job revenue.

## Demo Initialization

The demo company slug is `triangle-hvac-plumbing`. When `DEMO_MODE=true`, database-backed pages call `ensureDemoData()` if the demo company is absent. The seed uses upserts and transaction fingerprints, so it is safe to run more than once without deleting unrelated data.

## Optional AI

AI categorization is disabled unless `ENABLE_AI_CATEGORIZATION=true`, `OPENAI_API_KEY`, and `OPENAI_MODEL` are all present. The OpenAI fallback receives only merchant, description, memo, allowed categories, and limited job metadata.
