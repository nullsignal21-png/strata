# Security Audit Report

Audit date: 2026-07-23

## Dependency Audit

The lockfile was installed from scratch with `npm ci`.

| Command | Result |
| --- | --- |
| `npm audit` | 0 vulnerabilities |
| `npm audit --omit=dev` | 0 vulnerabilities |

The prior report's PostCSS and Sharp advisories are resolved by Next.js
16.2.11 plus lockfile overrides for PostCSS 8.5.21 and Sharp 0.35.0. No
`--force` install or framework downgrade was used.

## Application Controls

- Mutation routes enforce same-origin requests.
- JSON mutation bodies are limited to 64 KiB.
- CSV uploads require a `.csv` filename, an accepted text/CSV MIME type, a
  safe basename, at most 2 MiB, and at most 1,000 data rows.
- CSV text rejects unsafe control characters and text fields over 1,000
  characters.
- Exported spreadsheet cells neutralize `=`, `+`, `-`, and `@`, including
  after leading whitespace.
- Demo reset tokens use timing-safe comparison and are not embedded in client
  assets.
- QuickBooks OAuth requests use a timing-safe state check backed by an
  HttpOnly, SameSite=Lax cookie.
- Job and transaction lookups are scoped to the configured demo company.
- Production client assets contain no reset token, database URL marker, or
  configured database URL value.

## Residual Risk

Strata remains an unauthenticated investor demo. Same-origin checks reduce
browser CSRF risk but do not authenticate direct HTTP clients. Destructive
routes therefore require an authentication and authorization model before
multi-tenant or public production use. There is also no distributed rate
limiting. These are release limitations, not findings represented as fixed.

Detailed evidence is in `SECURITY_QA_RESULTS.md`.
