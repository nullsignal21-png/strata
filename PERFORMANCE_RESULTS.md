# Performance and Stress Results

Audit date: 2026-07-23

## Method

- Optimized Next.js 16.2.11 production server on `127.0.0.1:3001`.
- Disposable PostgreSQL 18.4 database on `127.0.0.1`.
- Synthetic CSV data only.
- One warm local process; timings are wall-clock client observations, not a
  capacity or concurrency benchmark.
- Every case reset the demo before execution. The runner reset the seed again
  when finished.

## Upload Results

| Case | Payload | Preview | Import | Result |
| --- | ---: | ---: | ---: | --- |
| 10 rows | 764 B | 23.72 ms | 102.66 ms | 200 |
| 100 rows | 7,492 B | 11.73 ms | 159.84 ms | 200 |
| 1,000 rows | 76,568 B | 37.66 ms | 1,281.06 ms | 200 |
| 5,000 rows | 395,568 B | 37.61 ms | Not run | 413 row-limit rejection |
| 1,000 maximum-width rows | 1,973,568 B | 53.77 ms | 1,572.22 ms | 200 |

Every accepted preview matched independently calculated row counts and exact
income/expense totals. Every accepted import inserted the expected row count.
The 5,000-row case was rejected before import because the supported maximum is
1,000 rows.

## Page Results at Maximum Data

After importing the maximum-width 1,000-row fixture:

| Page | Run 1 | Run 2 | Run 3 | Response bytes |
| --- | ---: | ---: | ---: | ---: |
| `/transactions` | 345.64 ms | 207.24 ms | 209.31 ms | 3,316,368 |
| `/reports` | 131.04 ms | 103.87 ms | 121.68 ms | 42,051 |

The production server process working set moved from 177,569,792 bytes
(169.3 MiB) before stress to 318,361,600 bytes (303.6 MiB) after stress, an
increase of 134.3 MiB. This is a single-process local observation and does not
establish a steady-state leak.

## Enforced Limits

- Maximum upload bytes: 2 MiB.
- Maximum data rows: 1,000.
- Maximum CSV text field: 1,000 characters.
- Maximum JSON mutation body: 64 KiB.
- Maximum bulk/categorize transaction IDs: 200.
- Maximum stored money value: `9,999,999,999.99`.

## Performance Limitation

`/transactions` loads and serializes the full company transaction collection,
then filters in the client. The maximum-width test produced a 3.3 MiB response.
This is acceptable for the bounded demo corpus but is not production-scalable.
Server-side pagination and filters are required before raising upload limits or
supporting sustained historical data.
