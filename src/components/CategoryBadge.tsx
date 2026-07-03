import { categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1", categoryClass(category))}>
      {category}
    </span>
  );
}
