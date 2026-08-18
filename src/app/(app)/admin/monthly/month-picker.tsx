"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatJpMonth, toMonthKey } from "@/lib/utils";

function monthOptions(): string[] {
  const now = new Date();
  return Array.from({ length: 15 }, (_, i) =>
    toMonthKey(new Date(now.getFullYear(), now.getMonth() + 2 - i, 1)),
  );
}

export function MonthPicker({ monthKey }: { monthKey: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium font-ui">対象月</span>
      <div className="w-44">
        <Select
          value={monthKey}
          onValueChange={(v) => router.push(`/admin/monthly?month=${v}`)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions().map((m) => (
              <SelectItem key={m} value={m}>
                {formatJpMonth(`${m}-01`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
