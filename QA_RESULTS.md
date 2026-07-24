# Strata Production-Readiness QA Results

Audit date: 2026-07-23
Starting commit: `9f81b3c378018084ae7b66dbbef017dda0a0e609`
Final QA commit: the immutable HEAD of `qa/strata-brutal-feature-audit`

## Release Decision

**Local and GitHub CI gates: PASS. Preview/Production gate: BLOCKED.**

All local correctness, database, browser, accessibility, build, audit, and
stress gates pass against a disposable database. GitHub Actions also passed
the full Linux workflow, including Firefox. Production must not be updated
until a Vercel Preview is run against a Preview-only database. No such remote
database credential is currently available, and the known Production database
was never used for mutation.

## Final Command Evidence

| Command | Result |
| --- | --- |
| `npm ci` | Pass; 496 packages installed/audited |
| `npm run db:generate` | Pass |
| `npm run db:migrate:deploy` | Pass; no pending migration |
| `npm run db:seed` twice | Pass; identical table counts |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run test` | Pass; 7 files, 132 tests |
| `npm run build` | Pass; 21 routes built |
| `npm run test:e2e` | Pass; 29 executed tests |
| `git diff --check` | Pass; line-ending notices only |
| `npm audit` | Pass; 0 vulnerabilities |
| `npm audit --omit=dev` | Pass; 0 vulnerabilities |
| GitHub Actions run 30059926384 | Pass; 5m25s, 36 Playwright tests |

Baseline was 3 Vitest files with 18 tests and one Playwright demo flow. Final
coverage is 7 Vitest files with 132 tests plus 29 Playwright tests.

## Browser Results

| Project | Tests | Result |
| --- | ---: | --- |
| API | 6 | Pass |
| Chromium desktop | 15 | Pass |
| Chromium mobile | 1 parameterized test covering 30 page/viewport combinations | Pass |
| WebKit | 7 | Pass |
| Firefox local | 0 | Explicitly excluded: Playwright Juggler fails before page launch on this Windows host |
| Firefox Linux CI | 7 | Pass |

The Chromium mobile test covers 375x667, 390x844, 768x1024, 1366x768, and
1920x1080 across dashboard, upload, transactions, jobs, reports, and settings.
WebKit axe checks found zero WCAG A/AA violations on the six primary pages.
The complete Linux run is:
`https://github.com/nullsignal21-png/strata/actions/runs/30059926384`.

## Deployment Gate

- QA branch remote SHA: `034da820cd256b19c5f39086714e5098cfc159ba`
  for the code-bearing audit commit.
- Vercel Preview: not created. The connected project has no Preview deployment
  and no verified Preview-only database credential.
- Production: `https://strata-silk-five.vercel.app` remains unchanged on
  `9f81b3c378018084ae7b66dbbef017dda0a0e609`.
- Production promotion is intentionally blocked until the complete destructive
  suite passes on an isolated remote database.

## Defects Found and Fixed

| ID | Severity | Reproduction/root cause | Exact fix and evidence |
| --- | --- | --- | --- |
| QA-01 | High | Foreign transaction IDs could be changed/deleted; lookup was not company-scoped. | Company-scoped route queries; cross-company integration regression. |
| QA-02 | High | Foreign job IDs could be read/changed/deleted. | Company-scoped detail/update/delete queries; cross-company regression. |
| QA-03 | High | Five concurrent identical imports could race through duplicate checks, abort a Prisma transaction, or create empty batches. | Per-company PostgreSQL advisory lock, in-transaction duplicate query, reject before batch creation; 1 success/4 conflicts/1 batch. |
| QA-04 | High | Concurrent resets performed non-atomic delete/reseed sequences. | Advisory-locked reset transaction; two concurrent resets both return 200 and exact seed state. |
| QA-05 | High | Dependency audit reported vulnerable PostCSS/Sharp trees. | Next.js/eslint config 16.2.11 and targeted overrides; both audits zero. |
| QA-06 | Medium | JavaScript date parsing normalized impossible and locale-dependent dates. | Strict ISO/US parser with calendar round-trip validation; leap/invalid corpus. |
| QA-07 | Medium | Floating-point rounding corrupted half-cent and aggregate money values. | Integer-cent parse and `sumMoney`; `1.005`, `0.1+0.2`, reports, batches, jobs regressions. |
| QA-08 | Medium | Explicit type and reverse sign inputs could misclassify direction. | Explicit type map and selectable sign convention used identically in preview/import. |
| QA-09 | Medium | Duplicate headers, malformed rows, empty/header-only data, oversized text, and controls were not reliably rejected. | Structural Papa Parse error handling, normalized-header check, explicit empty states, text/control bounds. |
| QA-10 | Medium | Users could not map unknown columns; rapid mapping changes could import stale preview state. | Nine mapping controls, abort/version preview requests, submit current mapping; Chromium regression. |
| QA-11 | Medium | Partial-overlap batch totals used all parsed rows instead of only new inserts. | Derive batch totals from importable rows inside transaction; PostgreSQL and Chromium regressions. |
| QA-12 | Medium | Whitespace-prefixed spreadsheet formulas bypassed export protection. | Check first non-whitespace marker and apostrophe-prefix; unit/export regressions. |
| QA-13 | Medium | Uploads had no safe byte/row boundary and weak filename/MIME handling. | 2 MiB, 1,000 rows, basename, extension, MIME checks; API and stress regressions. |
| QA-14 | Medium | JSON mutations accepted unbounded bodies and had inconsistent malformed-body errors. | Shared 64 KiB JSON reader with safe 400/413 responses. |
| QA-15 | Medium | Browser cross-origin mutation requests were accepted. | Shared same-origin mutation guard; attacker Origin receives 403 without CORS allowance. |
| QA-16 | Medium | QuickBooks callback lacked request state binding. | Cryptographic HttpOnly SameSite=Lax state cookie and timing-safe comparison. |
| QA-17 | Medium | Deleting a job left stale suggested-job references. | Transactionally clear assignment and suggestion before delete; integration regression. |
| QA-18 | Medium | Duplicate job names surfaced as a 500. | Map unique-name conflict to 409; integration regression. |
| QA-19 | Medium | Job dates, clearable city/address, and financial boundaries were not consistently editable/validated. | Strict date/money validation and complete edit controls; API and Chromium regressions. |
| QA-20 | Medium | Rule matching was whitespace-sensitive and overlapping DB rule order was nondeterministic. | Normalize whitespace/case and sort rules deterministically; every seeded rule plus overlap tests. |
| QA-21 | Medium | UTC date display/filter conversion could shift a transaction by one day. | Treat stored transaction dates as UTC date-only values; Chromium filter regression. |
| QA-22 | Medium | Required 375 px layout overflowed by 61 px. | Explicit base grid columns, `min-w-0`, and bounded chart/table containers; 30 responsive combinations. |
| QA-23 | Medium | Reset UI reloaded before preserving success, had weak network feedback, and allowed repeated submission. | Refresh after response, persistent live message, network error handling, disabled pending button; Chromium regression. |
| QA-24 | Medium | Row-limit preview returned a successful response instead of a limit status. | Upload route maps row-limit parse result to 413; API regression. |
| QA-25 | Low | Controls lacked unique labels/live announcements/focus assurance. | Accessible labels, live status regions, disabled-saving state, focus test, axe suite. |
| QA-26 | Low | Playwright's local server could remain running on Windows after tests. | Dedicated runner owns and terminates its exact process tree; final run exits cleanly. |
| QA-27 | Low | Security report documented known vulnerabilities as accepted despite available safe resolution. | Dependency update and current evidence-based report. |

## Remaining Limitations

1. **High:** No authentication or user authorization. Public mutation APIs are
   unsuitable for real multi-tenant use.
2. **Medium:** No distributed rate limiting.
3. **Medium:** No server-side transaction pagination; maximum-width test
   returned 3.3 MiB.
4. **Medium:** A Preview-only remote database secret is required before the
   destructive Preview suite can run. Production credentials must not be
   reused.
5. **Low:** Local Firefox is blocked by a host-level Playwright Juggler failure;
   Linux CI is the required Firefox gate.
6. Report date filtering, transaction amount/description editing, and full
   QuickBooks token exchange/sync are intentionally not implemented.
7. No destructive database fault injection was performed. Transactional
   duplicate/import/reset invariants and safe error responses were tested.

Detailed CSV, security, and performance evidence is in
`CSV_COMPATIBILITY.md`, `SECURITY_QA_RESULTS.md`, and
`PERFORMANCE_RESULTS.md`.
