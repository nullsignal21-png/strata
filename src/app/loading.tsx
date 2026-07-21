export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f7f4ee] p-6 text-slate-950">
      <div className="mx-auto grid max-w-5xl gap-4">
        <div className="h-8 w-48 animate-pulse rounded-md bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-32 animate-pulse rounded-lg bg-white shadow-sm" />
          <div className="h-32 animate-pulse rounded-lg bg-white shadow-sm" />
          <div className="h-32 animate-pulse rounded-lg bg-white shadow-sm" />
        </div>
        <div className="h-72 animate-pulse rounded-lg bg-white shadow-sm" />
      </div>
    </div>
  );
}
