"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, Receipt, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { cn, formatJpDate, formatJpMonth, formatYen, weekdayJp } from "@/lib/utils";
import { deleteApplicationAction, deleteEntryAction } from "./actions";

type Application = {
  id: string;
  monthKey: string;
  status: "draft" | "submitted";
  submittedAt: string | null;
  commuteEntries: { id: string; date: string; routeName: string; amount: number }[];
  itemEntries: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    amount: number;
  }[];
  freeItemEntries: {
    id: string;
    name: string;
    amount: number;
    hasReceipt: boolean;
  }[];
};

export function ApplicationCard({ application }: { application: Application }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  const commuteTotal = application.commuteEntries.reduce((s, e) => s + e.amount, 0);
  const itemTotal = application.itemEntries.reduce((s, e) => s + e.amount, 0);
  const freeTotal = application.freeItemEntries.reduce((s, e) => s + e.amount, 0);
  const total = commuteTotal + itemTotal + freeTotal;
  const entryCount =
    application.commuteEntries.length +
    application.itemEntries.length +
    application.freeItemEntries.length;

  function removeEntry(kind: "commute" | "item" | "freeItem", id: string, label: string) {
    if (!confirm(`「${label}」を削除します。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await deleteEntryAction(kind, id);
      setFeedback(
        res.ok
          ? { kind: "success", message: res.message }
          : { kind: "error", message: res.error },
      );
      if (res.ok) router.refresh();
    });
  }

  function removeApplication() {
    if (
      !confirm(
        `${formatJpMonth(`${application.monthKey}-01`)}の申請を、明細ごとすべて削除します。よろしいですか？`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteApplicationAction(application.id);
      if (res.ok) router.refresh();
      else setFeedback({ kind: "error", message: res.error });
    });
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex flex-1 items-center gap-3 text-left"
            aria-expanded={open}
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-display text-xl font-semibold text-primary">
                  {formatJpMonth(`${application.monthKey}-01`)}
                </span>
                <StatusBadge status={application.status} />
              </p>
              <p className="text-xs text-muted-foreground font-ui">
                {entryCount} 件の明細
                {application.submittedAt &&
                  ` · 提出日 ${formatJpDate(application.submittedAt.slice(0, 10))}`}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-semibold text-primary">
              {formatYen(total)}
            </span>
            <Button asChild variant="secondary" size="sm">
              <a href={`/api/expenses/${application.id}/pdf`}>
                <Download className="size-3.5" />
                PDF
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="この申請を削除"
              className="text-destructive hover:bg-destructive/10"
              disabled={pending}
              onClick={removeApplication}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <FeedbackBanner feedback={feedback} className="mt-3" />

        {open && (
          <div className="mt-5 flex flex-col gap-5 border-t border-border pt-4 animate-fade-in">
            {/* 通勤費明細 */}
            <section>
              <h3 className="mb-2 flex items-baseline justify-between text-sm font-semibold font-ui">
                通勤費明細
                <span className="font-normal text-muted-foreground">
                  小計 {formatYen(commuteTotal)}
                </span>
              </h3>
              {application.commuteEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground font-ui">なし</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {application.commuteEntries.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 px-3 py-2 text-sm font-ui"
                    >
                      <span className="w-28 shrink-0 text-muted-foreground">
                        {Number(e.date.slice(5, 7))}/{Number(e.date.slice(8))}（
                        {weekdayJp(e.date)}）
                      </span>
                      <span className="min-w-0 flex-1 truncate">{e.routeName}</span>
                      <span className="shrink-0">{formatYen(e.amount)}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="削除"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={pending}
                        onClick={() =>
                          removeEntry("commute", e.id, `${e.date} ${e.routeName}`)
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 小物購入費明細 */}
            <section>
              <h3 className="mb-2 flex items-baseline justify-between text-sm font-semibold font-ui">
                小物購入費明細（カテゴリ）
                <span className="font-normal text-muted-foreground">
                  小計 {formatYen(itemTotal)}
                </span>
              </h3>
              {application.itemEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground font-ui">なし</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {application.itemEntries.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 px-3 py-2 text-sm font-ui"
                    >
                      <span className="min-w-0 flex-1 truncate">{e.name}</span>
                      <span className="w-20 shrink-0 text-right text-muted-foreground">
                        {e.quantity} {e.unit}
                      </span>
                      <span className="shrink-0">{formatYen(e.amount)}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="削除"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={pending}
                        onClick={() => removeEntry("item", e.id, e.name)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 自由入力品目明細 */}
            <section>
              <h3 className="mb-2 flex items-baseline justify-between text-sm font-semibold font-ui">
                自由入力品目明細
                <span className="font-normal text-muted-foreground">
                  小計 {formatYen(freeTotal)}
                </span>
              </h3>
              {application.freeItemEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground font-ui">なし</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {application.freeItemEntries.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 px-3 py-2 text-sm font-ui"
                    >
                      <span className="min-w-0 flex-1 truncate">{e.name}</span>
                      {e.hasReceipt && (
                        <a
                          href={`/api/receipts/${e.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex shrink-0 items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                        >
                          <Receipt className="size-3" />
                          領収書
                        </a>
                      )}
                      <span className="shrink-0">{formatYen(e.amount)}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="削除"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={pending}
                        onClick={() => removeEntry("freeItem", e.id, e.name)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
