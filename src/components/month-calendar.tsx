"use client";

import { cn } from "@/lib/utils";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/**
 * 対象月のカレンダー。日付を複数選択できる。
 * `claimed` に含まれる日付は申請済みとして選択不可にする。
 */
export function MonthCalendar({
  monthKey,
  selected,
  claimed,
  onToggle,
  disabled,
}: {
  monthKey: string;
  selected: Set<string>;
  claimed: Set<string>;
  onToggle: (dateKey: string) => void;
  disabled?: boolean;
}) {
  const [year, month] = monthKey.split("-").map(Number);
  const total = daysInMonth(year, month);
  const leading = new Date(year, month - 1, 1).getDay();

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from(
      { length: total },
      (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn(
              "py-1 text-center text-[11px] font-medium font-ui",
              i === 0 && "text-destructive/80",
              i === 6 && "text-primary/70",
              i > 0 && i < 6 && "text-muted-foreground",
            )}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateKey, idx) => {
          if (!dateKey) return <div key={`blank-${idx}`} />;

          const day = Number(dateKey.slice(8));
          const isClaimed = claimed.has(dateKey);
          const isSelected = selected.has(dateKey);
          const dow = new Date(year, month - 1, day).getDay();

          return (
            <button
              key={dateKey}
              type="button"
              disabled={disabled || isClaimed}
              onClick={() => onToggle(dateKey)}
              title={isClaimed ? "申請済み" : undefined}
              aria-pressed={isSelected}
              className={cn(
                "flex h-9 items-center justify-center rounded-md text-sm font-ui transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold"
                  : isClaimed
                    ? "cursor-not-allowed bg-muted text-muted-foreground/50 line-through"
                    : "hover:bg-accent",
                !isSelected && !isClaimed && dow === 0 && "text-destructive/80",
                !isSelected && !isClaimed && dow === 6 && "text-primary/70",
                disabled && "opacity-50",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-2 text-[11px] text-muted-foreground font-ui">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-primary" />
          選択中
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-muted" />
          申請済み（選択不可）
        </span>
      </div>
    </div>
  );
}
