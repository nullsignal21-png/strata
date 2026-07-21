# Deployment

1. Import the GitHub repository into Vercel.
2. Keep the existing default production branch unless deliberately changed.
3. Add Prisma Postgres through the Vercel Marketplace.
4. Connect the Prisma Postgres database to the Vercel project.
5. Configure `DATABASE_URL` from the connected database.
6. Configure `DIRECT_URL` only when the selected database provides one.
7. Set `DEMO_MODE=true`.
8. Set `DEMO_COMPANY_SLUG=triangle-hvac-plumbing`.
9. Set a strong `DEMO_RESET_TOKEN`.
10. Leave `ENABLE_AI_CATEGORIZATION=false` for the public demo.
11. Optionally set `OPENAI_API_KEY` and `OPENAI_MODEL`.
12. Optionally set QuickBooks sandbox variables:
    `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_REDIRECT_URI`, and `QUICKBOOKS_ENV=sandbox`.
13. Deploy with the Vercel build command `npm run vercel-build`.
14. Check `/api/health` after deployment.
15. Test upload, import, transaction review, job detail, reports, exports, and demo reset.
16. Use separate preview and production databases so preview migrations cannot alter production data.

`npm run vercel-build` runs:

```bash
prisma generate
prisma migrate deploy
next build
```

Do not use `prisma migrate dev` in production deployments.
