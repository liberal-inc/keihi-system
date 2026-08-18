"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatJpMonth } from "@/lib/utils";

const ALL = "__all__";

function recentMonths(currentMonth: string): string[] {
  const [y, m] = currentMonth.split("-").map(Number);
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(y, m - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function MonthFilter({
  monthKey,
  currentMonth,
  scope,
  canViewTeam,
}: {
  monthKey: string;
  currentMonth: string;
  scope: "mine" | "team";
  canViewTeam: boolean;
}) {
  const router = useRouter();

  function navigate(next: { month?: string; scope?: string }) {
    const q = new URLSearchParams();
    const month = next.month ?? monthKey;
    const s = next.scope ?? scope;
    if (month) q.set("month", month);
    if (s === "team") q.set("scope", "team");
    router.push(`/reports${q.size ? `?${q}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium font-ui">月で絞り込み</span>
        <div className="w-44">
          <Select
            value={monthKey || ALL}
            onValueChange={(v) => navigate({ month: v === ALL ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>すべての月</SelectItem>
              {recentMonths(currentMonth).map((m) => (
                <SelectItem key={m} value={m}>
                  {formatJpMonth(`${m}-01`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {canViewTeam && (
        <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1">
          {(
            [
              ["mine", "自分の日報"],
              ["team", "担当部署の日報"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => navigate({ scope: value })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-ui transition-colors",
                scope === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
