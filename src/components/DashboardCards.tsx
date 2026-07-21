import { AlertTriangle, CircleDollarSign, ReceiptText, TrendingUp } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";

type CardsProps = {
  totalRevenue: number;
  totalJobCosts: number;
  grossProfit: number;
  averageMargin: number;
  cashCollected: number;
  uncategorizedCount: number;
  unassignedCount: number;
  needsReviewCount: number;
};

export function DashboardCards(props: CardsProps) {
  const cards = [
    {
      label: "Total revenue",
      value: formatCurrency(props.totalRevenue),
      detail: "Actual revenue across seeded jobs",
      icon: CircleDollarSign,
    },
    {
      label: "Total job costs",
      value: formatCurrency(props.totalJobCosts),
      detail: "Assigned materials, fuel, subs, and overhead",
      icon: ReceiptText,
    },
    {
      label: "Gross profit",
      value: formatCurrency(props.grossProfit),
      detail: `${formatPercent(props.averageMargin)} blended margin`,
      icon: TrendingUp,
    },
    {
      label: "Cash collected",
      value: formatCurrency(props.cashCollected),
      detail: "Imported income, not added to job revenue",
      icon: CircleDollarSign,
    },
    {
      label: "Review queue",
      value: String(props.needsReviewCount),
      detail: `${props.uncategorizedCount} uncategorized, ${props.unassignedCount} unassigned`,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{card.value}</p>
              </div>
              <div className="rounded-md bg-teal-50 p-2 text-teal-700">
                <Icon size={20} />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">{card.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
