"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

export function DemoResetForm() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  async function resetDemo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Reset the Triangle demo data to its original seeded state?")) return;
    setIsResetting(true);
    setMessage(null);

    try {
      try {
        const response = await fetch("/api/demo/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          setMessage((await response.json().catch(() => ({}))).error || "Demo reset failed.");
          setIsResetting(false);
          return;
        }

        setMessage("Demo data reset successfully.");
        setToken("");
        window.location.reload();
      } catch (e) {
        console.error(e);
        setMessage("Network error or CORS issue during reset.");
        setIsResetting(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Demo reset failed.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <form onSubmit={resetDemo} className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-amber-50 p-2 text-amber-700">
          <RotateCcw size={22} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Reset demo data</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Restores Triangle HVAC & Plumbing to the seeded investor-demo state. Requires DEMO_RESET_TOKEN.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          type="password"
          placeholder="Demo reset token"
          className="focus-ring min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isResetting}
          className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <RotateCcw size={17} />
          Reset
        </button>
      </div>
      {message ? <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
    </form>
  );
}
