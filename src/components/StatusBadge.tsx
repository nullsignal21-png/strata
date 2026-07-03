import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  imported: "Imported",
  categorized: "Categorized",
  needs_review: "Needs review",
  reviewed: "Reviewed",
  planned: "Planned",
  active: "Active",
  completed: "Completed",
};

const classes: Record<string, string> = {
  imported: "bg-blue-50 text-blue-700 ring-blue-200",
  categorized: "bg-teal-50 text-teal-700 ring-teal-200",
  needs_review: "bg-amber-50 text-amber-800 ring-amber-200",
  reviewed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  planned: "bg-slate-100 text-slate-700 ring-slate-200",
  active: "bg-teal-50 text-teal-700 ring-teal-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1", classes[status])}>
      {labels[status] ?? status}
    </span>
  );
}
