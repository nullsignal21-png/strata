export const EXPENSE_CATEGORIES = [
  "Materials",
  "Tools & Equipment",
  "Fuel & Vehicle",
  "Subcontractor",
  "Permits & Fees",
  "Office/Admin",
  "Software",
  "Utilities",
  "Insurance",
  "Job Site / Disposal",
  "Meals",
  "Other Expense",
  "Uncategorized",
] as const;

export const INCOME_CATEGORIES = ["Customer Payment", "Refund", "Other Income", "Uncategorized Income"] as const;

export const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as const;

export type Category = (typeof CATEGORIES)[number];
export type TransactionDirectionValue = "income" | "expense";

export function isCategory(value: string): value is Category {
  return CATEGORIES.includes(value as Category);
}

export function categoriesForDirection(direction: TransactionDirectionValue) {
  return direction === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function defaultCategoryForDirection(direction: TransactionDirectionValue) {
  return direction === "income" ? "Uncategorized Income" : "Uncategorized";
}

export function categoryClass(category: string) {
  const classes: Record<string, string> = {
    Materials: "bg-teal-50 text-teal-700 ring-teal-200",
    "Tools & Equipment": "bg-cyan-50 text-cyan-700 ring-cyan-200",
    "Fuel & Vehicle": "bg-amber-50 text-amber-800 ring-amber-200",
    Subcontractor: "bg-violet-50 text-violet-700 ring-violet-200",
    "Permits & Fees": "bg-blue-50 text-blue-700 ring-blue-200",
    "Office/Admin": "bg-slate-100 text-slate-700 ring-slate-200",
    Software: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    Utilities: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Insurance: "bg-rose-50 text-rose-700 ring-rose-200",
    "Job Site / Disposal": "bg-orange-50 text-orange-700 ring-orange-200",
    Meals: "bg-lime-50 text-lime-700 ring-lime-200",
    "Other Expense": "bg-stone-100 text-stone-700 ring-stone-200",
    Uncategorized: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    "Customer Payment": "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Refund: "bg-sky-50 text-sky-700 ring-sky-200",
    "Other Income": "bg-blue-50 text-blue-700 ring-blue-200",
    "Uncategorized Income": "bg-zinc-100 text-zinc-700 ring-zinc-200",
  };

  return classes[category] ?? classes.Uncategorized;
}
