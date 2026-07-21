"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#f7f4ee] p-6 text-slate-950">
      <div className="mx-auto max-w-2xl rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-950">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6">
          The app hit a runtime error. Check the server logs for details, then retry the current view.
        </p>
        <button
          type="button"
          onClick={reset}
          className="focus-ring mt-5 rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
