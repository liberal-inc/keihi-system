"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatJpMonth, formatYen, toMonthKey } from "@/lib/utils";
import { submitApplicationAction } from "../actions";
import { CategoryTab, type CategoryView, type ItemEntryView } from "./category-tab";
import { CommuteTab } from "./commute-tab";
import { FreeItemTab, type FreeItemView } from "./free-item-tab";
import type { RouteView } from "./route-dialog";

type Draft = {
  id: string;
  commuteEntries: { id: string; date: string; routeName: string; amount: number }[];
  itemEntries: ItemEntryView[];
  freeItemEntries: FreeItemView[];
};

/** 当月を基準に前後の月を選択肢として並べる */
function monthOptions(): string[] {
  const now = new Date();
  const list: string[] = [];
  for (let offset = 2; offset >= -11; offset--) {
    list.push(toMonthKey(new Date(now.getFullYear(), now.getMonth() - offset, 1)));
  }
  return list.reverse();
}

export function ExpenseWorkspace({
  monthKey,
  routes,
  ratePerKm,
  claimedByRoute,
  categories,
  draft,
}: {
  monthKey: string;
  routes: RouteView[];
  ratePerKm: number;
  claimedByRoute: Record<string, string[]>;
  categories: CategoryView[];
  draft: Draft | null | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  const commuteTotal =
    draft?.commuteEntries.reduce((s, e) => s + e.amount, 0) ?? 0;
  const itemTotal = draft?.itemEntries.reduce((s, e) => s + e.amount, 0) ?? 0;
  const freeTotal = draft?.freeItemEntries.reduce((s, e) => s + e.amount, 0) ?? 0;
  const grandTotal = commuteTotal + itemTotal + freeTotal;
  const entryCount =
    (draft?.commuteEntries.length ?? 0) +
    (draft?.itemEntries.length ?? 0) +
    (draft?.freeItemEntries.length ?? 0);

  function submitApplication() {
    setFeedback(null);
    startTransition(async () => {
      const res = await submitApplicationAction(monthKey);
      if (res.ok) {
        setFeedback({ kind: "success", message: res.message });
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 対象月の選択 */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium font-ui" htmlFor="month-select">
          対象月
        </label>
        <div className="w-48">
          <Select
            value={monthKey}
            onValueChange={(v) => router.push(`/expenses/new?month=${v}`)}
          >
            <SelectTrigger id="month-select">
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

      {/* 3タブ構成 */}
      <Tabs defaultValue="commute">
        <TabsList>
          <TabsTrigger value="commute">通勤費</TabsTrigger>
          <TabsTrigger value="free">小物（自由入力）</TabsTrigger>
          <TabsTrigger value="category">小物（カテゴリ一覧）</TabsTrigger>
        </TabsList>

        <TabsContent value="commute">
          <CommuteTab
            monthKey={monthKey}
            routes={routes}
            ratePerKm={ratePerKm}
            claimedByRoute={claimedByRoute}
          />
        </TabsContent>

        <TabsContent value="free">
          <FreeItemTab
            monthKey={monthKey}
            entries={draft?.freeItemEntries ?? []}
          />
        </TabsContent>

        <TabsContent value="category">
          <CategoryTab
            monthKey={monthKey}
            categories={categories}
            entries={draft?.itemEntries ?? []}
          />
        </TabsContent>
      </Tabs>

      {/* 作成中の申請サマリ */}
      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold font-ui">
              {formatJpMonth(`${monthKey}-01`)}の作成中の申請
            </h2>
            <span className="text-xs text-muted-foreground font-ui">
              {entryCount} 件の明細
            </span>
          </div>

          <dl className="grid gap-3 sm:grid-cols-4">
            {[
              ["通勤費", commuteTotal],
              ["小物（カテゴリ）", itemTotal],
              ["小物（自由入力）", freeTotal],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="rounded-md border border-border bg-secondary/40 px-3 py-2"
              >
                <dt className="text-xs text-muted-foreground font-ui">
                  {label as string}
                </dt>
                <dd className="mt-0.5 text-lg font-medium font-ui">
                  {formatYen(value as number)}
                </dd>
              </div>
            ))}
            <div className="rounded-md border border-primary/30 bg-accent/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground font-ui">合計</dt>
              <dd className="mt-0.5 font-display text-2xl font-semibold text-primary">
                {formatYen(grandTotal)}
              </dd>
            </div>
          </dl>

          <FeedbackBanner feedback={feedback} className="mt-4" />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground font-ui">
              提出後も、同じ月に何度でも追加で申請できます。
            </p>
            <Button onClick={submitApplication} disabled={pending || entryCount === 0}>
              <Send className="size-4" />
              {pending ? "提出中…" : "この内容で提出する"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
