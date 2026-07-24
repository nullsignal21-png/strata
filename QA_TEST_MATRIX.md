# Strata QA Test Matrix

Audit date: 2026-07-23
Starting commit: `9f81b3c378018084ae7b66dbbef017dda0a0e609`
Branch: `qa/strata-brutal-feature-audit`

## Test Environment

- Windows host, Node.js 24.14.1, Next.js 16.2.11, PostgreSQL 18.4.
- Disposable local database:
  `strata_qa_brutal_9f81b3c` on `127.0.0.1`.
- Synthetic financial data only.
- `ENABLE_AI_CATEGORIZATION=false`; no OpenAI dependency.
- No production mutation or stress request was made.
- Seed run 1 and run 2 both produced: Company 1, Job 5, Transaction 32,
  UploadBatch 1, CategoryRule 19, IntegrationConnection 0.

## Feature Inventory

| Surface | Implemented behavior |
| --- | --- |
| `/` | Product entry page and demo-dashboard navigation |
| `/dashboard` | Revenue, costs, profit, margin, cash, review counts, risk jobs, top jobs, recent uploads |
| `/upload` | File selection, sign convention, nine column mappings, preview, sample rows, import |
| `/transactions` | Search; date, direction, category, assignment, review, and upload filters; category, direction, job, review, delete, selection and bulk actions |
| `/jobs` | Job list, create form, validation, profitability summary |
| `/jobs/[id]` | Job detail, dates/profile editing, expense breakdown, transactions, delete |
| `/reports` | Category spend, monthly income/expense, unassigned expenses, low-margin jobs, cash versus revenue, job profitability |
| `/settings` | Demo profile, QuickBooks handoff/export, demo reset |
| `/api/health` | Database health |
| `/api/upload` | Preview and transactional CSV import |
| `/api/transactions` | List, patch, delete |
| `/api/transactions/bulk` | Review, categorization, and suggested-job bulk actions |
| `/api/jobs` | List and create |
| `/api/jobs/[id]` | Patch and delete |
| `/api/categorize` | Rule-based categorization and optional AI path |
| `/api/export` | QuickBooks transaction and job-profitability CSVs |
| `/api/demo/reset` | Token-protected atomic demo reset |
| `/api/quickbooks/connect` | OAuth initiation or export fallback |
| `/api/quickbooks/callback` | OAuth state validation and demo handoff |

No server actions were found. Transactions are intentionally shown as one
client-filtered collection with no pagination. Transaction amount and
description editing, report date filters, and complete QuickBooks token
exchange/sync are not implemented.

## Coverage Matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Clean dependency install | `npm ci` | Pass, 496 packages, 0 vulnerabilities |
| Prisma generation/migrations | `db:generate`, `db:migrate:deploy` | Pass, 1 migration current |
| Seed idempotency | Two seeds plus direct table counts | Pass, identical counts |
| CSV parser corpus | `csv-compatibility.test.ts`, `csv.test.ts` | Pass, 67 compatibility cases plus 8 core tests |
| Preview calculations | Unit, component, Chromium UI tests | Pass; independent income/expense totals and no preview writes |
| Import persistence | PostgreSQL integration and Chromium tests | Pass; normalized fields, batches, duplicates, partial overlap, retries |
| Concurrent import | Five simultaneous requests | Pass; 1 success, 4 conflicts, 1 row, 1 batch |
| Transactions | Component, API integration, Chromium flows | Pass for all implemented filters and mutations |
| Categorization | Every one of 19 seeded rules, variations, priority, no-match, AI disabled | Pass |
| Jobs | API integration and Chromium CRUD/profitability flow | Pass |
| Dashboard | Direct independent database calculations | Pass for seed, mutation, negative/zero revenue, empty company |
| Reports | Direct independent database calculations | Pass for totals, ordering, empty company, dashboard consistency |
| Exports | Unit and Chromium/API parsing | Pass for headers, values, quoting, UTF-8, decimals, formula neutralization |
| Demo reset | API integration and Chromium UI | Pass for wrong/missing token, exact state, repeat/concurrent requests |
| API boundaries | Six Playwright API tests plus integration tests | Pass for payloads, IDs, methods, limits, rollback-relevant invariants |
| Company isolation | Cross-company integration tests | Pass |
| Security | API tests, audits, static bundle scan | Pass for implemented controls; auth/rate-limit limitations remain |
| Accessibility | Axe WCAG A/AA on six pages, focus check | Pass, zero detected violations |
| Responsive | Six pages at five required viewports | Pass, no page-level horizontal overflow |
| Chromium desktop | CSV and feature flows | Pass, 15 tests |
| Chromium mobile | 30 page/viewport combinations | Pass, 1 parameterized test |
| WebKit | Six page/axe checks and focus | Pass, 7 tests |
| Firefox local | Browser launch diagnostics | Not executed; Windows Juggler fails before page launch |
| Firefox CI | Seven Linux smoke/accessibility tests | Pass |
| GitHub Actions | PostgreSQL 16, clean install, seed twice, lint, typecheck, 132 Vitest, audits, build, 36 Playwright | Pass |
| Performance | Production Next server, local disposable DB | Pass within enforced limits; scaling limitation documented |
| Lint/typecheck/build | Final commands | Pass |

## Automated Totals

- Baseline: 3 test files, 18 Vitest tests, 1 Playwright flow.
- Final local: 7 test files, 132 Vitest tests, all passed.
- Final Playwright: 29 executed tests, all passed.
- Linux CI Playwright: 36 tests, all passed, including 7 Firefox tests.
- Silent skips: zero. Firefox is explicitly excluded locally with a printed
  reason and was executed successfully in Linux CI.
