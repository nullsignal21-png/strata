import Link from "next/link";

export function SetupEmptyState() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <h1 className="text-2xl font-semibold">Demo database is not seeded yet</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6">
        Add DATABASE_URL, run the Prisma migration, then seed the Triangle HVAC & Plumbing demo data.
      </p>
      <div className="mt-4 rounded-md bg-white p-4 font-mono text-sm text-slate-800">
        npm run db:migrate
        <br />
        npm run db:seed
      </div>
      <Link href="/" className="mt-5 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
        Back to landing
      </Link>
    </div>
  );
}
