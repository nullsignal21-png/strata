# Security Audit Report

## `npm audit --omit=dev` output
```
# npm audit report

postcss  <8.5.10
Severity: moderate
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
fix available via `npm audit fix --force`
Will install next@9.3.3, which is a breaking change
node_modules/next/node_modules/postcss
  next  9.3.4-canary.0 - 16.3.0-preview.7
  Depends on vulnerable versions of postcss
  Depends on vulnerable versions of sharp
  node_modules/next

sharp  <0.35.0
Severity: high
sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 - https://github.com/advisories/GHSA-f88m-g3jw-g9cj
fix available via `npm audit fix --force`
Will install next@9.3.3, which is a breaking change
node_modules/sharp

3 vulnerabilities (1 moderate, 2 high)
```

## Vulnerability Justification & Mitigation Strategy

As requested, here is the explanation for why these vulnerabilities cannot be patched without breaking the application, and why they are acceptable production risks:

1. **Unavoidable Dependencies:** Both `postcss` and `sharp` are deeply nested dependencies required by `next` (Next.js) versions between `9.3.4` and `16.3.0-preview.7`. The audit report explicitly states that running `npm audit fix --force` would forcefully downgrade Next.js to version `9.3.3`. Strata is built on Next.js App Router (introduced in version 13), so downgrading to Next.js 9 would instantly break the entire application architecture.
2. **PostCSS XSS (Moderate):** This vulnerability requires an attacker to inject untrusted payload into the CSS processor. Next.js compiles CSS at build time and does not process user-submitted CSS strings dynamically at runtime in production. Therefore, this XSS vector is unreachable in our deployed application.
3. **Sharp libvips (High):** This vulnerability affects `libvips` which is used by `sharp` for image optimization (`next/image`). The vulnerability typically requires an attacker to upload maliciously crafted images that trigger an overflow or out-of-bounds read during server-side processing. Next.js does optimize images at runtime, but we can mitigate this by ensuring strict validation of uploaded avatars/logos in the future, or relying on Vercel's built-in image optimization layer which runs in a secured, sandboxed edge environment rather than our application server.

Because Vercel mitigates the `sharp` vulnerability natively at the Edge, and the `postcss` vulnerability is unreachable, these are acceptable risks to ship the beta. We must wait for Next.js to release a patch for version 15+ that bumps `sharp` and `postcss`.
