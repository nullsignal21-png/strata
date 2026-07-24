# Security QA Results

Audit date: 2026-07-23
Environment: local disposable PostgreSQL database and local Next.js servers.

## Results

| Check | Evidence | Result |
| --- | --- | --- |
| Full dependency audit | `npm audit` | Pass, 0 vulnerabilities |
| Production dependency audit | `npm audit --omit=dev` | Pass, 0 vulnerabilities |
| Formula injection | Unit and exported CSV parse for `=`, `+`, `-`, `@`, leading whitespace | Pass, cells prefixed with apostrophe |
| HTML/script text | Parser, React smoke, no console/runtime errors | Pass, inert text |
| SQL-looking text | Parser and parameterized Prisma paths | Pass, inert text |
| Traversal filename | `..\..\escape.csv` | Rejected 400 |
| Dangerous MIME | Executable content type renamed `.csv` | Rejected 400 |
| Oversized upload | More than 2 MiB | Rejected 413 |
| Excess rows | 1,001 rows in preview and import | Rejected 413 |
| Malformed/unrelated CSV | API tests with database count checks | Rejected, no writes |
| Oversized JSON | More than 64 KiB | Rejected 413 |
| Malformed JSON and IDs | API tests | Safe 400/404, no stack trace |
| Cross-origin mutation | Attacker Origin against job creation | Rejected 403, no permissive CORS |
| Cross-company transactions | Update and delete foreign IDs | Rejected 404, records retained |
| Cross-company jobs | Read, update, delete foreign IDs | Rejected 404 |
| Reset token | Missing, wrong, correct, concurrent | 400, 403, 200, atomic |
| Reset isolation | Unrelated company present during reset | Preserved |
| OAuth state | Cookie and callback state comparison | HttpOnly, SameSite=Lax, timing-safe |
| Client bundle secrets | `.next/static` scan | No token, URL marker, or configured DB value |
| Error disclosure | Malformed requests and production build | No stack, Prisma class, token, or DB URL |
| Unsupported methods | `PUT /api/jobs` | 405 |
| Cardinality abuse | 201 bulk/categorize IDs | Rejected 400 |

## Fixed Security Defects

| ID | Severity | Reproduction and root cause | Fix and regression evidence |
| --- | --- | --- | --- |
| SEC-01 | High | A foreign company transaction ID could be patched/deleted because mutation lookup used only `id`. | Scope lookup and mutation by demo `companyId`; integration test retains foreign rows and receives 404. |
| SEC-02 | High | A foreign job ID could be read, patched, or deleted because job lookup used only `id`. | Scope all job operations by company; integration test receives 404. |
| SEC-03 | High | Lockfile resolved vulnerable PostCSS/Sharp versions. | Next.js 16.2.11 and targeted overrides; both audits now report zero. |
| SEC-04 | Medium | Browser cross-origin POSTs were accepted because mutation routes did not check origin. | Shared same-origin guard on every mutation route; attacker Origin receives 403. |
| SEC-05 | Medium | Mutation JSON had no byte limit and malformed bodies had inconsistent handling. | Shared 64 KiB JSON parser with safe 400/413 responses. |
| SEC-06 | Medium | Upload accepted dangerous MIME, unsafe basename, unlimited bytes, and unlimited rows. | `.csv`/MIME/basename checks plus 2 MiB and 1,000-row limits. |
| SEC-07 | Medium | Spreadsheet formulas after leading whitespace bypassed export neutralization. | Detect first non-whitespace formula marker and prefix apostrophe; regression cases cover spaces, tab, and CR. |
| SEC-08 | Medium | QuickBooks callback did not bind the response to an initiated browser request. | Cryptographic state cookie and timing-safe callback comparison. |
| SEC-09 | Medium | Reset token comparison was ordinary string equality and concurrent resets raced. | Timing-safe comparison plus company advisory-lock transaction. |
| SEC-10 | Low | The checked-in security report claimed unresolved vulnerabilities that were no longer acceptable/current. | Replaced with current audit evidence and explicit residual risk. |

## Residual Security Limitations

1. **High:** There is no user authentication or authorization model. Same-origin
   checks are not identity checks, and direct HTTP clients can invoke public
   mutation APIs. Do not treat the app as multi-tenant production software.
2. **Medium:** There is no distributed rate limiting or per-client abuse
   control. Upload and request limits bound individual operations only.
3. **Medium:** The demo reset remains intentionally exposed behind a shared
   secret. A production deployment must provision a strong secret and should
   disable this route outside the demo.
4. **Low:** Full QuickBooks exchange/sync is intentionally absent. Only the
   OAuth handoff state boundary and CSV export path were tested.

No destructive security test targeted Production or unrelated infrastructure.
