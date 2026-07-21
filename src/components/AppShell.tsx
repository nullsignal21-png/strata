"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  UploadCloud,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/transactions", label: "Transactions", icon: FileText },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-black/10 bg-[#13201f] px-4 py-5 text-white lg:block">
        <Link href="/" className="focus-ring block rounded-md px-2 py-1">
          <p className="text-2xl font-semibold">Strata</p>
          <p className="mt-1 text-sm text-teal-100">Job profitability from messy CSVs</p>
        </Link>
        <nav className="mt-10 grid gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href === "/jobs" && pathname.startsWith("/jobs"));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-teal-400 text-slate-950" : "text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-black/10 bg-[#f7f4ee]/90 px-5 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-semibold">
              Strata
            </Link>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                Demo Mode
              </span>
              <button
                type="button"
                aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
                onClick={() => setIsMobileOpen((value) => !value)}
                className="focus-ring rounded-md border border-slate-300 bg-white p-2 text-slate-800"
              >
                {isMobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
          {isMobileOpen ? (
            <nav className="mt-3 grid gap-1 rounded-md border border-black/10 bg-white p-2 shadow-sm">
              {navItems.map((item) => {
                const active = pathname === item.href || (item.href === "/jobs" && pathname.startsWith("/jobs"));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                      active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <Icon size={17} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </header>
        <main className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-9">
          <div className="mb-5 hidden items-center justify-end lg:flex">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              Demo Mode
            </span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
