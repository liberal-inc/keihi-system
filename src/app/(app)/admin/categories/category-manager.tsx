"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Pencil, Plus, Power, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/input";
import { cn, formatYen } from "@/lib/utils";
import {
  deleteCategoryAction,
  saveCategoryAction,
  toggleCategoryAction,
} from "./actions";

export type CategoryView = {
  id: string;
  name: string;
  unitCost: number;
  unit: string;
  isActive: boolean;
  usageCount: number;
};

const EMPTY = { id: "", name: "", unitCost: "", unit: "個" };

export function CategoryManager({
  categories,
}: {
  categories: CategoryView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [form, setForm] = useState(EMPTY);

  const editing = form.id !== "";
  const canSave = form.name.trim() !== "" && Number(form.unitCost) > 0 && form.unit.trim() !== "";

  function reset() {
    setForm(EMPTY);
  }

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setFeedback(null);
    startTransition(async () => {
      const res = await fn();
      setFeedback(
        res.ok
          ? { kind: "success", message: res.message ?? "完了しました" }
          : { kind: "error", message: res.error ?? "失敗しました" },
      );
      if (res.ok) router.refresh();
    });
  }

  function save() {
    run(async () => {
      const res = await saveCategoryAction({
        id: form.id || undefined,
        name: form.name,
        unitCost: Number(form.unitCost),
        unit: form.unit,
        isActive: editing
          ? (categories.find((c) => c.id === form.id)?.isActive ?? true)
          : true,
      });
      if (res.ok) reset();
      return res;
    });
  }

  function startEdit(c: CategoryView) {
    setForm({
      id: c.id,
      name: c.name,
      unitCost: String(c.unitCost),
      unit: c.unit,
    });
    setFeedback(null);
  }

  const activeCount = categories.filter((c) => c.isActive).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* 入力フォーム */}
      <Card className="h-fit">
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold font-ui">
              {editing ? "カテゴリを編集" : "カテゴリを追加"}
            </h2>
            {editing && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="size-3.5" />
                やめる
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-name">品目名</Label>
            <Input
              id="c-name"
              value={form.name}
              placeholder="例: ボールペン"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-cost">単価（円）</Label>
              <Input
                id="c-cost"
                type="number"
                min="1"
                step="1"
                value={form.unitCost}
                placeholder="150"
                onChange={(e) =>
                  setForm((f) => ({ ...f, unitCost: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-unit">単位</Label>
              <Input
                id="c-unit"
                value={form.unit}
                placeholder="本 / 個 / 箱 など"
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
          </div>

          <FeedbackBanner feedback={feedback} />

          <Button onClick={save} disabled={pending || !canSave}>
            {pending ? "保存中…" : editing ? "更新" : "追加"}
          </Button>
        </CardContent>
      </Card>

      {/* 一覧 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold font-ui">登録済みカテゴリ</h2>
          <span className="text-xs text-muted-foreground font-ui">
            有効 {activeCount} / 全 {categories.length} 件
          </span>
        </div>

        {categories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="mx-auto mb-3 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground font-ui">
                まだカテゴリがありません。
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {categories.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-4 py-3",
                      !c.isActive && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium font-ui">{c.name}</span>
                        {!c.isActive && (
                          <Badge variant="secondary">無効</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground font-ui">
                        {formatYen(c.unitCost)} / {c.unit}
                        {c.usageCount > 0 && ` · 申請実績 ${c.usageCount} 件`}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title={c.isActive ? "無効にする" : "有効にする"}
                        disabled={pending}
                        onClick={() => run(() => toggleCategoryAction(c.id))}
                      >
                        <Power className="size-3.5" />
                        {c.isActive ? "無効化" : "有効化"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="編集"
                        onClick={() => startEdit(c)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="削除"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={pending}
                        onClick={() => {
                          const extra =
                            c.usageCount > 0
                              ? `\n\n過去の申請明細 ${c.usageCount} 件は残ります（金額は変わりません）。`
                              : "";
                          if (!confirm(`「${c.name}」を削除します。よろしいですか？${extra}`))
                            return;
                          run(() => deleteCategoryAction(c.id));
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground font-ui">
          「無効化」すると社員の申請画面に表示されなくなりますが、過去の申請明細は残ります。
          削除した場合も、明細には申請時点の品目名・単価が保存されているため金額は変わりません。
        </p>
      </div>
    </div>
  );
}
