"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/input";
import {
  RATE_PER_KM_MAX,
  RATE_PER_KM_MIN,
  carDailyFare,
  nonTaxableBracketLabel,
  nonTaxableMonthlyLimit,
} from "@/lib/commute";
import { formatYen } from "@/lib/utils";
import { updateRatePerKmAction } from "./actions";

/** 単価の変更が金額にどう効くかを見せるためのサンプル距離 */
const SAMPLE_KM = [5, 12, 20, 30];

export function SettingsForm({ ratePerKm }: { ratePerKm: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [value, setValue] = useState(String(ratePerKm));

  const parsed = Number(value);
  const valid =
    Number.isInteger(parsed) &&
    parsed >= RATE_PER_KM_MIN &&
    parsed <= RATE_PER_KM_MAX;
  const changed = parsed !== ratePerKm;

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateRatePerKmAction(parsed);
      setFeedback(
        res.ok
          ? { kind: "success", message: res.message }
          : { kind: "error", message: res.error },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardContent className="flex flex-col gap-4 pt-5">
          <h2 className="text-sm font-semibold font-ui">
            車通勤の単価（円/km）
          </h2>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rate">1kmあたりの単価</Label>
            <div className="flex items-center gap-2">
              <Input
                id="rate"
                type="number"
                min={RATE_PER_KM_MIN}
                max={RATE_PER_KM_MAX}
                step="1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground font-ui">円/km</span>
            </div>
            <p className="text-xs text-muted-foreground font-ui">
              設定範囲は {RATE_PER_KM_MIN}〜{RATE_PER_KM_MAX} 円/km です。
            </p>
            {!valid && value !== "" && (
              <p className="text-xs text-destructive font-ui">
                {RATE_PER_KM_MIN}〜{RATE_PER_KM_MAX} の整数で入力してください。
              </p>
            )}
          </div>

          <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs font-ui">
            <p className="font-medium">交通費の計算式</p>
            <p className="mt-1 text-muted-foreground">
              片道距離 × 2（往復） × 単価（円/km）
            </p>
          </div>

          <FeedbackBanner feedback={feedback} />

          <Button onClick={save} disabled={pending || !valid || !changed}>
            {pending ? "保存中…" : "保存"}
          </Button>
          {!changed && (
            <p className="text-center text-xs text-muted-foreground font-ui">
              現在の設定と同じ値です
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardContent className="pt-5">
          <h2 className="mb-1 text-sm font-semibold font-ui">
            この単価での 1 日あたり交通費
          </h2>
          <p className="mb-3 text-xs text-muted-foreground font-ui">
            {valid ? `${parsed} 円/km` : `${ratePerKm} 円/km`} で計算した場合の目安です。
            非課税限度額は国税庁の基準（距離別の月額上限）です。
          </p>

          <ul className="divide-y divide-border rounded-md border border-border">
            {SAMPLE_KM.map((km) => (
              <li
                key={km}
                className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm font-ui"
              >
                <span className="w-24 shrink-0 text-muted-foreground">
                  片道 {km}km
                </span>
                <span className="w-28 shrink-0 font-medium">
                  {formatYen(carDailyFare(km, valid ? parsed : ratePerKm))}
                </span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                  非課税限度額 月 {formatYen(nonTaxableMonthlyLimit(km))}（
                  {nonTaxableBracketLabel(km)}）
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-muted-foreground font-ui">
            ※ 単価を変更しても、すでに提出済みの申請の金額は変わりません
            （申請時点の金額を明細に保存しているため）。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
