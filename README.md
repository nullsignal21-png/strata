# Strata

**Live Demo:** [https://strata-silk-five.vercel.app](https://strata-silk-five.vercel.app)
Strata is a Phase 1 investor-demo MVP for small trade businesses. It turns uploaded bank or credit card CSVs into categorized, job-assigned transactions and shows job-level profitability for a seeded contractor demo company.

## Setup

```bash
npm install
```

Create a PostgreSQL database and set environment variables:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/strata"
OPENAI_API_KEY=""
QUICKBOOKS_CLIENT_ID=""
QUICKBOOKS_CLIENT_SECRET=""
QUICKBOOKS_REDIRECT_URI="http://localhost:3000/api/quickbooks/callback"
QUICKBOOKS_ENV="sandbox"
```

## Database

```bash
npm run db:migrate
npm run db:seed
```

The seed creates Triangle HVAC & Plumbing, five demo jobs, category rules, and realistic transactions.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000` and choose `Enter Demo Dashboard`.

## Demo CSV Format

Supported headers are mapped intelligently:

```csv
date,description,merchant,amount,category
2026-06-25,Home Depot Cary - Patel condenser pad,Home Depot,-248.77,
2026-06-26,Shell fuel for Apex Greenway crew,Shell,64.20,
```

Also supported: `transaction date`, `posted date`, `details`, `memo`, `payee`, `debit`, `credit`, and `type`.

## Included

- Landing page and polished SaaS dashboard
- CSV upload with preview and import
- Rule-based categorization with OpenAI structured-output fallback
- Heuristic job assignment with OpenAI fallback
- Transaction review/edit workflow
- Jobs list and job detail profitability
- Reports with QuickBooks-ready CSV export
- Optional QuickBooks sandbox connect route when env vars exist

## Intentionally Not Included

- AI CFO
- Forecasting
- Tax generation
- Payroll
- Supplier recommendations
- Benchmarking
- Enterprise permissions
- Full accounting logic
