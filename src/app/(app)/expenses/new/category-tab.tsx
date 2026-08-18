"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Package, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { formatYen } from "@/lib/utils";
import { deleteEntryAction, submitCategoryItemsAction } from "../actions";

export type CategoryView = {
  id: string;
  name: string;
  unitCost: number;
  unit: string;
};

export type ItemEntryView = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  amount: number;
};

export function CategoryTab({
  monthKey,
  categories,
  entries,
}: {
  monthKey: string;
  categories: CategoryView[];
  entries: ItemEntryView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function setQty(id: string, value: number) {
    setQuantities((prev) => {
      const next = { ...prev };
      const q = Math.max(0, Math.min(9999, Math.floor(value) || 0));
      if (q === 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }

  const picked = Object.entries(quantities);
  const pickedTotal = picked.reduce((sum, [id, q]) => {
    const c = categories.find((x) => x.id === id);
    return sum + (c ? c.unitCost * q : 0);
  }, 0);

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const res = await submitCategoryItemsAction({
        monthKey,
        items: picked.map(([categoryId, quantity]) => ({ categoryId, quantity })),
      });
      if (res.ok) {
        setQuantities({});
        setFeedback({ kind: "success", message: res.message });
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  function remove(entry: ItemEntryView) {
    if (!confirm(`「${entry.name}」を削除します。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await deleteEntryAction("item", entry.id);
      if (res.ok) {
        setFeedback({ kind: "success", message: res.message });
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  const entriesTotal = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* カテゴリ一覧 */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold font-ui">品目を選択</h2>

        {categories.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Package className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground font-ui">
                管理者が設定した小物カテゴリがまだありません。
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {categories.map((c) => {
              const q = quantities[c.id] ?? 0;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium font-ui">{c.name}</p>
                    <p className="text-sm text-muted-foreground font-ui">
                      {formatYen(c.unitCost)} / {c.unit}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="減らす"
                      disabled={q === 0}
                      onClick={() => setQty(c.id, q - 1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      value={q}
                      aria-label={`${c.name} の数量`}
                      onChange={(e) => setQty(c.id, Number(e.target.value))}
                      className="h-8 w-16 text-center"
                    />
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="増やす"
                      onClick={() => setQty(c.id, q + 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>

                  <span className="w-24 shrink-0 text-right text-sm font-medium font-ui">
                    {q > 0 ? formatYen(c.unitCost * q) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* 登録済みエントリ */}
        <div className="mt-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold font-ui">
            登録済みのカテゴリ品目
          </h2>
          <span className="text-sm text-muted-foreground font-ui">
            小計{" "}
            <span className="font-medium text-foreground">
              {formatYen(entriesTotal)}
            </span>
          </span>
        </div>

        {entries.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground font-ui">
            まだ品目がありません。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium font-ui">{e.name}</p>
                  <p className="text-sm text-muted-foreground font-ui">
                    {e.quantity} {e.unit} · {formatYen(e.amount)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="削除"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => remove(e)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 集計 */}
      <Card className="h-fit">
        <CardContent className="flex flex-col gap-3 pt-5">
          <h2 className="text-sm font-semibold font-ui">選択中の品目</h2>

          {picked.length === 0 ? (
            <p className="text-sm text-muted-foreground font-ui">
              数量を1以上にすると、ここに表示されます。
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm font-ui">
              {picked.map(([id, q]) => {
                const c = categories.find((x) => x.id === id);
                if (!c) return null;
                return (
                  <li key={id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {c.name} × {q}
                    </span>
                    <span className="shrink-0">{formatYen(c.unitCost * q)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-baseline justify-between border-t border-border pt-2">
            <span className="text-sm text-muted-foreground font-ui">小計</span>
            <span className="font-display text-2xl font-semibold text-primary">
              {formatYen(pickedTotal)}
            </span>
          </div>

          <FeedbackBanner feedback={feedback} />

          <Button onClick={submit} disabled={pending || picked.length === 0}>
            {pending ? "追加中…" : "申請に追加"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
