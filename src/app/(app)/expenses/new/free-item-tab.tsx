"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Pencil, Receipt, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/input";
import { formatYen } from "@/lib/utils";
import {
  deleteEntryAction,
  submitFreeItemAction,
  updateFreeItemAction,
} from "../actions";

export type FreeItemView = {
  id: string;
  name: string;
  amount: number;
  hasReceipt: boolean;
};

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export function FreeItemTab({
  monthKey,
  entries,
}: {
  monthKey: string;
  entries: FreeItemView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setEditingId(null);
    setName("");
    setAmount("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit() {
    setFeedback(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("amount", amount);
    if (file) fd.set("receipt", file);

    startTransition(async () => {
      let res;
      if (editingId) {
        fd.set("id", editingId);
        res = await updateFreeItemAction(fd);
      } else {
        fd.set("monthKey", monthKey);
        res = await submitFreeItemAction(fd);
      }

      if (res.ok) {
        reset();
        setFeedback({ kind: "success", message: res.message });
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  function startEdit(entry: FreeItemView) {
    setEditingId(entry.id);
    setName(entry.name);
    setAmount(String(entry.amount));
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setFeedback(null);
  }

  function remove(entry: FreeItemView) {
    if (!confirm(`「${entry.name}」を削除します。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await deleteEntryAction("freeItem", entry.id);
      if (res.ok) {
        if (editingId === entry.id) reset();
        setFeedback({ kind: "success", message: res.message });
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  const canSubmit = name.trim() !== "" && Number(amount) > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* 入力フォーム */}
      <Card className="h-fit">
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold font-ui">
              {editingId ? "品目を編集" : "品目を追加"}
            </h2>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="size-3.5" />
                編集をやめる
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="free-name">品物名</Label>
            <Input
              id="free-name"
              value={name}
              placeholder="例: 名刺ケース"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="free-amount">金額（円）</Label>
            <Input
              id="free-amount"
              type="number"
              min="1"
              step="1"
              value={amount}
              placeholder="例: 1200"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="free-receipt">領収書画像（任意）</Label>
            <input
              ref={fileRef}
              id="free-receipt"
              type="file"
              accept={ACCEPT}
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="justify-start font-normal"
            >
              <ImagePlus className="size-4" />
              {file ? file.name : "画像を選択・撮影"}
            </Button>
            <p className="text-xs text-muted-foreground font-ui">
              JPEG・PNG・WebP・HEIC、8MB まで。iPhone
              で撮った写真（HEIC）はそのまま添付できます
              {editingId && "。選択しない場合は既存の画像を保持します"}。
            </p>
          </div>

          <FeedbackBanner feedback={feedback} />

          <Button onClick={submit} disabled={pending || !canSubmit}>
            {pending ? "保存中…" : editingId ? "更新" : "申請に追加"}
          </Button>
        </CardContent>
      </Card>

      {/* 登録済み一覧 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold font-ui">
            登録済みの自由入力品目
          </h2>
          <span className="text-sm text-muted-foreground font-ui">
            小計 <span className="font-medium text-foreground">{formatYen(total)}</span>
          </span>
        </div>

        {entries.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground font-ui">
              まだ品目がありません。
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium font-ui">
                    {e.name}
                    {e.hasReceipt && (
                      <Badge variant="secondary">
                        <Receipt className="mr-1 size-3" />
                        領収書あり
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground font-ui">
                    {formatYen(e.amount)}
                  </p>
                </div>

                {e.hasReceipt && (
                  <a
                    href={`/api/receipts/${e.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs text-primary underline-offset-2 hover:underline font-ui"
                  >
                    画像を表示
                  </a>
                )}

                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="編集"
                    onClick={() => startEdit(e)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="削除"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => remove(e)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
