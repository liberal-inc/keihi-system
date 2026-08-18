"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, MapPin, Pencil, Plus, Train, Trash2 } from "lucide-react";

import { MonthCalendar } from "@/components/month-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import {
  nonTaxableBracketLabel,
  nonTaxableMonthlyLimit,
  routeDailyFare,
} from "@/lib/commute";
import { cn, formatJpMonth, formatYen, weekdayJp } from "@/lib/utils";
import { deleteRouteAction, submitCommuteAction } from "../actions";
import { RouteDialog, type RouteView } from "./route-dialog";

export function CommuteTab({
  monthKey,
  routes,
  ratePerKm,
  claimedByRoute,
}: {
  monthKey: string;
  routes: RouteView[];
  ratePerKm: number;
  claimedByRoute: Record<string, string[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(
    routes[0]?.id ?? null,
  );
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [dialogRoute, setDialogRoute] = useState<RouteView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 経路を追加・削除した直後も選択が外れないよう、先頭の経路にフォールバックする
  const route =
    routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;
  const dailyFare = route ? routeDailyFare(route, ratePerKm) : 0;

  const claimed = useMemo(
    () => new Set(route ? (claimedByRoute[route.id] ?? []) : []),
    [claimedByRoute, route],
  );

  const selectedTotal = dailyFare * selectedDates.size;

  // 車通勤の場合、今月の申請済み分も含めて非課税限度額の超過を判定する
  const monthlyLimit =
    route?.transportType === "car" && route.distanceKm
      ? nonTaxableMonthlyLimit(route.distanceKm)
      : null;
  const monthTotalForRoute = dailyFare * (claimed.size + selectedDates.size);
  const overLimit = monthlyLimit !== null && monthTotalForRoute > monthlyLimit;

  function toggleDate(dateKey: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  function selectRoute(id: string) {
    setSelectedRouteId(id);
    setSelectedDates(new Set());
    setFeedback(null);
  }

  function submit() {
    if (!route) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await submitCommuteAction({
        monthKey,
        routeId: route.id,
        dateKeys: [...selectedDates],
      });
      if (res.ok) {
        setSelectedDates(new Set());
        setFeedback({ kind: "success", message: res.message });
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  function removeRoute(r: RouteView) {
    if (!confirm(`経路「${r.name}」を削除します。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await deleteRouteAction(r.id);
      if (res.ok) {
        if (selectedRouteId === r.id) setSelectedRouteId(null);
        setFeedback({ kind: "success", message: res.message });
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* 左: 経路一覧 */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold font-ui">通勤経路</h2>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDialogRoute(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            経路を登録
          </Button>
        </div>

        {routes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <MapPin className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground font-ui">
                通勤経路がまだ登録されていません。
                <br />
                「経路を登録」から出発地・到着地・交通手段を設定してください。
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {routes.map((r) => {
              const fare = routeDailyFare(r, ratePerKm);
              const active = r.id === route?.id;
              return (
                <li key={r.id}>
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                      active
                        ? "border-primary/60 bg-accent/50"
                        : "border-border bg-card hover:bg-secondary/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectRoute(r.id)}
                      className="flex flex-1 items-start gap-3 text-left"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {r.transportType === "car" ? (
                          <Car className="size-4" />
                        ) : (
                          <Train className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium font-ui">{r.name}</span>
                          <Badge variant="secondary">
                            {r.transportType === "car" ? "車" : "公共交通"}
                          </Badge>
                          {active && <Badge>選択中</Badge>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground font-ui">
                          {r.originName} → {r.destName}
                        </span>
                        <span className="mt-1 block text-xs font-ui">
                          1日 {formatYen(fare)}
                          {r.transportType === "car" && r.distanceKm != null && (
                            <span className="text-muted-foreground">
                              {" "}
                              （片道 {r.distanceKm}km × 2 × {ratePerKm}円/km）
                            </span>
                          )}
                        </span>
                      </span>
                    </button>

                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="編集"
                        onClick={() => {
                          setDialogRoute(r);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="削除"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => removeRoute(r)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 右: 出勤日の選択 */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold font-ui">
          出勤日を選択（{formatJpMonth(`${monthKey}-01`)}）
        </h2>

        {!route ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground font-ui">
              経路を選択すると出勤日を指定できます。
            </CardContent>
          </Card>
        ) : (
          <>
            <MonthCalendar
              monthKey={monthKey}
              selected={selectedDates}
              claimed={claimed}
              onToggle={toggleDate}
              disabled={pending}
            />

            {monthlyLimit !== null && route.distanceKm != null && (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs font-ui",
                  overLimit
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-border bg-secondary/50 text-muted-foreground",
                )}
              >
                <p className="font-medium">
                  非課税限度額: 月 {formatYen(monthlyLimit)}
                  <span className="font-normal">
                    {" "}
                    （{nonTaxableBracketLabel(route.distanceKm)}）
                  </span>
                </p>
                <p className="mt-0.5">
                  この経路の当月合計見込み {formatYen(monthTotalForRoute)}
                  {overLimit && " — 限度額を超えています（超過分は課税対象）"}
                </p>
              </div>
            )}

            <Card>
              <CardContent className="flex flex-col gap-3 pt-5">
                <div className="flex items-baseline justify-between text-sm font-ui">
                  <span className="text-muted-foreground">選択日数</span>
                  <span className="font-medium">{selectedDates.size} 日</span>
                </div>
                <div className="flex items-baseline justify-between text-sm font-ui">
                  <span className="text-muted-foreground">1日あたり</span>
                  <span className="font-medium">{formatYen(dailyFare)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-2">
                  <span className="text-sm text-muted-foreground font-ui">
                    小計
                  </span>
                  <span className="font-display text-2xl font-semibold text-primary">
                    {formatYen(selectedTotal)}
                  </span>
                </div>

                {selectedDates.size > 0 && (
                  <p className="text-xs text-muted-foreground font-ui">
                    {[...selectedDates]
                      .sort()
                      .map((d) => `${Number(d.slice(8))}(${weekdayJp(d)})`)
                      .join("、")}
                  </p>
                )}

                <FeedbackBanner feedback={feedback} />

                <Button
                  onClick={submit}
                  disabled={pending || selectedDates.size === 0}
                >
                  {pending ? "追加中…" : "通勤費を申請に追加"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <RouteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        route={dialogRoute}
        ratePerKm={ratePerKm}
        onSaved={(message) => {
          setFeedback({ kind: "success", message });
          router.refresh();
        }}
      />
    </div>
  );
}
