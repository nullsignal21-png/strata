import { Download, PlugZap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DemoResetForm } from "@/components/DemoResetForm";
import { SetupEmptyState } from "@/components/SetupEmptyState";
import { getCompanyState } from "@/lib/metrics";
import { quickBooksMode } from "@/lib/quickbooks";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const state = await getCompanyState();
  const mode = quickBooksMode();

  return (
    <AppShell>
      {state.state !== "ready" ? (
        <SetupEmptyState message={state.message} showCommands={state.state !== "database_unavailable"} />
      ) : (
        <div className="grid gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Demo settings</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">Settings & integrations</h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              QuickBooks does not block the demo. Missing sandbox credentials automatically falls back to export mode.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Company profile</h2>
              <dl className="mt-5 grid gap-4 text-sm">
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Company</dt>
                  <dd className="font-medium">{state.company.name}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Trade type</dt>
                  <dd className="font-medium">{state.company.tradeType}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Slug</dt>
                  <dd className="font-mono text-xs">{state.company.slug}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Demo company ID</dt>
                  <dd className="font-mono text-xs">{state.company.id}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-teal-50 p-2 text-teal-700">
                  <PlugZap size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">QuickBooks</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {mode === "sandbox_oauth"
                      ? "Sandbox credentials detected. The callback records a demo handoff only; the CSV export remains the reliable demo path."
                      : "QuickBooks export mode is active because sandbox environment variables are missing."}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {mode === "sandbox_oauth" ? (
                  <a
                    href="/api/quickbooks/connect"
                    className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    <PlugZap size={17} />
                    Connect QuickBooks Sandbox
                  </a>
                ) : null}
                <a
                  href="/api/export"
                  className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Download size={17} />
                  Export QuickBooks-ready CSV
                </a>
              </div>
            </div>
          </div>
          <DemoResetForm />
        </div>
      )}
    </AppShell>
  );
}
