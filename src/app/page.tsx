import Link from "next/link";
import { ArrowRight, BarChart3, UploadCloud } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#13201f] text-white">
      <section className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-[1fr_0.9fr] lg:px-10">
        <div className="max-w-3xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-teal-100">
            Built for HVAC, plumbing, and electrical contractors
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
            Strata
          </h1>
          <p className="mt-7 max-w-2xl text-xl leading-8 text-slate-200">
            Know which jobs are profitable before it is too late. Automatically turn messy transactions into
            job-level financial clarity.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-teal-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-teal-300"
            >
              Enter Demo Dashboard <ArrowRight size={18} />
            </Link>
            <Link
              href="/upload"
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Upload CSV <UploadCloud size={18} />
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-white/12 bg-white/8 p-5 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-sm text-teal-100">Triangle HVAC & Plumbing</p>
              <h2 className="mt-1 text-2xl font-semibold">Profitability snapshot</h2>
            </div>
            <BarChart3 className="text-teal-300" size={28} />
          </div>
          <div className="mt-6 grid gap-4">
            {[
              ["Cary HVAC Replacement", "$8.9k profit", "57% margin"],
              ["Apex Commercial Maintenance", "$10.9k profit", "62% margin"],
              ["Morrisville Emergency Plumbing", "$2.1k profit", "80% margin"],
              ["Durham Mini Split Install", "$4.0k profit", "50% margin"],
            ].map(([job, profit, margin]) => (
              <div key={job} className="grid grid-cols-[1fr_auto] gap-4 rounded-md bg-white/10 p-4">
                <div>
                  <p className="font-medium">{job}</p>
                  <p className="mt-1 text-sm text-slate-300">Transactions categorized and assigned</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-teal-200">{profit}</p>
                  <p className="mt-1 text-sm text-slate-300">{margin}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
