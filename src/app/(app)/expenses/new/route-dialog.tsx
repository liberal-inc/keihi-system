"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/input";
import {
  carDailyFare,
  nonTaxableBracketLabel,
  nonTaxableMonthlyLimit,
} from "@/lib/commute";
import { cn, formatYen } from "@/lib/utils";
import { saveRouteAction } from "../actions";

export type RouteView = {
  id: string;
  name: string;
  originName: string;
  destName: string;
  transportType: "public_transit" | "car";
  dailyFare: number | null;
  distanceKm: number | null;
};

type RouteForm = {
  name: string;
  originName: string;
  destName: string;
  transportType: "public_transit" | "car";
  dailyFare: string;
  distanceKm: string;
};

const EMPTY: RouteForm = {
  name: "",
  originName: "",
  destName: "",
  transportType: "public_transit",
  dailyFare: "",
  distanceKm: "",
};

export function RouteDialog({
  open,
  onOpenChange,
  route,
  ratePerKm,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: RouteView | null;
  ratePerKm: number;
  onSaved: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [form, setForm] = useState(EMPTY);

  // ダイアログを開くたびに、編集対象の内容を読み込み直す
  useEffect(() => {
    if (!open) return;
    setFeedback(null);
    setForm(
      route
        ? {
            name: route.name,
            originName: route.originName,
            destName: route.destName,
            transportType: route.transportType,
            dailyFare: route.dailyFare != null ? String(route.dailyFare) : "",
            distanceKm: route.distanceKm != null ? String(route.distanceKm) : "",
          }
        : EMPTY,
    );
  }, [open, route]);

  const isCar = form.transportType === "car";
  const km = Number(form.distanceKm);
  const validKm = Number.isFinite(km) && km > 0;
  const previewFare = isCar
    ? validKm
      ? carDailyFare(km, ratePerKm)
      : 0
    : Number(form.dailyFare) || 0;

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveRouteAction({
        id: route?.id,
        name: form.name,
        originName: form.originName,
        destName: form.destName,
        transportType: form.transportType,
        dailyFare: isCar ? null : Number(form.dailyFare) || null,
        distanceKm: isCar ? (validKm ? km : null) : null,
        originLat: null,
        originLng: null,
        destLat: null,
        destLng: null,
      });

      if (res.ok) {
        onOpenChange(false);
        onSaved(res.message);
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{route ? "経路を編集" : "通勤経路を登録"}</DialogTitle>
          <DialogDescription>
            出発地・到着地と交通手段を設定します。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="route-name">経路名</Label>
            <Input
              id="route-name"
              value={form.name}
              placeholder="例: 自宅 → 本社"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-origin">出発地</Label>
              <Input
                id="route-origin"
                value={form.originName}
                placeholder="住所・建物名・駅名"
                onChange={(e) =>
                  setForm((f) => ({ ...f, originName: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-dest">到着地</Label>
              <Input
                id="route-dest"
                value={form.destName}
                placeholder="住所・建物名・駅名"
                onChange={(e) =>
                  setForm((f) => ({ ...f, destName: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>交通手段</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["public_transit", "公共交通"],
                  ["car", "車"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, transportType: value }))
                  }
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-ui transition-colors",
                    form.transportType === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-secondary/60",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {isCar ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-km">片道距離（km）</Label>
              <Input
                id="route-km"
                type="number"
                min="0"
                step="0.1"
                value={form.distanceKm}
                placeholder="例: 12.4"
                onChange={(e) =>
                  setForm((f) => ({ ...f, distanceKm: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground font-ui">
                Googleマップなどで出発地から到着地を検索し、
                <span className="font-medium text-foreground">
                  表示された距離をそのまま入力
                </span>
                してください（小数第1位まで）。
              </p>
              <p className="text-xs text-muted-foreground font-ui">
                交通費 = 片道距離 × 2（往復） × {ratePerKm} 円/km
              </p>

              {validKm && (
                <div className="mt-1 rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs font-ui">
                  <p>
                    1日あたり{" "}
                    <span className="font-semibold">{formatYen(previewFare)}</span>
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    非課税限度額 月 {formatYen(nonTaxableMonthlyLimit(km))}（
                    {nonTaxableBracketLabel(km)}）
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-fare">1日あたりの金額（往復合計・円）</Label>
              <Input
                id="route-fare"
                type="number"
                min="0"
                step="1"
                value={form.dailyFare}
                placeholder="例: 760"
                onChange={(e) =>
                  setForm((f) => ({ ...f, dailyFare: e.target.value }))
                }
              />
            </div>
          )}

          <FeedbackBanner feedback={feedback} />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            キャンセル
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
