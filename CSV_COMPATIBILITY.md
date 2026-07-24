# CSV Compatibility

Audit date: 2026-07-23

## Supported Inputs

A CSV must contain:

- A date column.
- Either a signed amount column or debit/credit columns.
- Either a description or merchant column.

Automatic header matching is case- and punctuation-insensitive. Recognized
fields include date/transaction date/posted date, description/details,
merchant/payee, memo, amount, debit, credit, category, and transaction type.
All nine fields can also be mapped manually in the upload UI.

Supported dates are `YYYY-MM-DD`, `MM/DD/YYYY`, `M/D/YYYY`, `MM-DD-YYYY`,
and valid ISO timestamps. Slash dates are deliberately interpreted as US
month/day/year.

Supported money values include whole dollars, decimals rounded half-up to
cents, `$`, `USD`, comma thousands separators, leading signs, and
parenthesized negatives. Stored amounts are positive and direction is stored
separately. The UI supports negative-expense and positive-expense signed
amount conventions. Explicit types recognize debit, withdrawal, expense,
purchase, charge, credit, deposit, income, and receipt.

## 67-Case Parser Corpus

All cases below were executed in `src/tests/csv-compatibility.test.ts`.

### Standard and Encoding

1. Date, description, signed amount.
2. Date, merchant, signed amount.
3. Separate debit and credit columns.
4. Explicit transaction-type column.
5. Negative expenses and positive income.
6. Positive expenses and negative income.
7. Reverse sign convention.
8. Dollar currency symbol.
9. `USD` currency code.
10. Parenthesized negative.
11. Quoted comma in a description.
12. UTF-8 merchant/description.
13. Embedded quoted newline.
14. UTF-8 BOM.
15. Windows CRLF.
16. Unix LF.
17. Header/value whitespace.
18. Header capitalization.
19. Reordered columns.
20. Extra unused columns.

### Dates

21. `YYYY-MM-DD`.
22. `MM/DD/YYYY`.
23. `M/D/YYYY`.
24. `MM-DD-YYYY`.
25. ISO timestamp.
26. Whitespace around date.
27. Valid leap day.
28. US interpretation of ambiguous `01/02/2026`.
29. Invalid non-leap February 29.
30. Impossible February 30.
31. Non-date text.
32. Unsupported day-first `31/01/2026`.

### Amounts

33. Whole-dollar value.
34. Two-decimal value.
35. More than two decimals, `1.005` to `1.01`.
36. Very small accepted value, `0.005` to `0.01`.
37. Decimal(12,2) maximum, `9,999,999,999.99`.
38. Parenthesized amount.
39. Zero rejected.
40. Value rounding to zero rejected.
41. Blank amount rejected.
42. Non-numeric amount rejected.
43. Scientific notation rejected.
44. Above database precision rejected.
45. Debit and credit both populated rejected.
46. Debit and credit both blank rejected.

### Structure

47. Empty file rejected.
48. Header-only file rejected.
49. Missing required columns rejected.
50. Duplicate normalized headers rejected.
51. Blank lines ignored.
52. Too few columns rejected.
53. Too many columns rejected.
54. Broken quotation rejected.
55. Unrelated CSV rejected.
56. Bounded long Unicode accepted.
57. Description over 1,000 characters rejected.
58. Duplicate rows within one file deduplicated.

### Mapping, Fingerprints, and Hostile Text

59. Manual column remapping.
60. Fingerprint stability across case/whitespace changes.
61. Different merchants do not falsely deduplicate.
62. `=` prefix preserved as inert stored text.
63. `+` prefix preserved as inert stored text.
64. `-` prefix preserved as inert stored text.
65. `@` prefix preserved as inert stored text.
66. HTML, script-like, and SQL-looking text preserved as inert text.
67. Null and unsupported control characters rejected.

Parameterized entries account for the individual concrete assertions within
these grouped descriptions.

## Import and UI Compatibility

Chromium tests independently exercised standard signed amounts, reverse sign
convention, debit/credit mapping, invalid-row exclusion, manual remapping,
first/repeated imports, partial overlap, and five concurrent retries. Database
tests also proved:

- Fingerprints are company-scoped.
- Reordered and harmlessly whitespace-normalized rows remain duplicates.
- Distinct merchants remain distinct.
- Preview performs no database writes.
- Batch totals include only newly inserted rows.
- Invalid and duplicate rows are excluded.
- A fully duplicate retry creates neither rows nor an empty batch.

## Intentional Rejections and Limits

- Files over 2 MiB.
- More than 1,000 data rows.
- Non-`.csv` filenames, traversal-like filenames, and dangerous MIME types.
- Empty/header-only/unrelated/malformed files.
- Missing date, monetary, or description/merchant fields.
- Duplicate headers after normalization.
- Day-first and other locale-dependent dates.
- Scientific notation.
- Zero or values rounding to zero.
- Values above `9,999,999,999.99`.
- Rows with both debit and credit populated.
- Unsafe control characters.
- Text fields over 1,000 characters.

HTML, script-like text, SQL-looking text, and formula-looking text are accepted
as data. React renders the text escaped, and CSV export neutralizes spreadsheet
formula prefixes.
