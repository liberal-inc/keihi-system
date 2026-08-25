"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, Pencil, Plus, Power, Route as RouteIcon, Train, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import {
  nonTaxableBracketLabel,
  nonTaxableMonthlyLimit,
  routeDailyFare,
} from "@/lib/commute";
import { cn, formatYen } from "@/lib/utils";
import { deleteRouteAction, toggleRouteAction } from "./actions";
import { AdminRouteDialog, type AdminRouteView } from "./route-dialog";

export type UserWithRoutes = {
  id: string;
  name: string;
  employeeNo: string | null;
  departmentName: string | null;
  routes: AdminRouteView[];
};

export function RouteManager({
  users,
  ratePerKm,
}: {
  users: UserWithRoutes[];
  ratePerKm: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRoute, setDialogRoute] = useState<AdminRouteView | null>(null);
  const [dialogUserId, setDialogUserId] = useState<string>("");

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

  const totalRoutes = users.reduce((s, u) => s + u.routes.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground font-ui">
          対象社員 {users.length} 名 · 登録経路 {totalRoutes} 件 · 車通勤の単価{" "}
          <span className="font-medium text-foreground">{ratePerKm} 円/km</span>
        </p>
      </div>

      <FeedbackBanner feedback={feedback} />

      {users.map((u) => (
        <Card key={u.id}>
          <CardContent className="pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium font-ui">{u.name}</span>
                  {u.employeeNo && (
                    <span className="text-xs text-muted-foreground font-ui">
                      No.{u.employeeNo}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground font-ui">
                  {u.departmentName ?? "部署未設定"} · 経路 {u.routes.length} 件
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDialogRoute(null);
                  setDialogUserId(u.id);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                経路を追加
              </Button>
            </div>

            {u.routes.length === 0 ? (
              <p className="rounded-md border border-border bg-secondary/30 px-4 py-5 text-center text-sm text-muted-foreground font-ui">
                通勤経路が未登録です。
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {u.routes.map((r) => {
                  const fare = routeDailyFare(r, ratePerKm);
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "flex flex-wrap items-center gap-3 px-3 py-2.5",
                        !r.isActive && "opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {r.transportType === "car" ? (
                          <Car className="size-4" />
                        ) : (
                          <Train className="size-4" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-medium font-ui">{r.name}</span>
                          <Badge variant="secondary">
                            {r.transportType === "car" ? "車" : "公共交通"}
                          </Badge>
                          {!r.isActive && <Badge variant="destructive">無効</Badge>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground font-ui">
                          {r.originName} → {r.destName}
                        </p>
                        <p className="mt-0.5 text-xs font-ui">
                          1日 {formatYen(fare)}
                          {r.transportType === "car" && r.distanceKm != null && (
                            <span className="text-muted-foreground">
                              {" "}
                              （片道 {r.distanceKm}km × 2 × {ratePerKm}円/km · 非課税限度額 月{" "}
                              {formatYen(nonTaxableMonthlyLimit(r.distanceKm))}／
                              {nonTaxableBracketLabel(r.distanceKm)}）
                            </span>
                          )}
                          {r.entryCount > 0 && (
                            <span className="text-muted-foreground">
                              {" "}
                              · 申請実績 {r.entryCount} 日分
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          title={r.isActive ? "無効にする" : "有効にする"}
                          onClick={() => run(() => toggleRouteAction(r.id))}
                        >
                          <Power className="size-3.5" />
                          {r.isActive ? "無効化" : "有効化"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="編集"
                          onClick={() => {
                            setDialogRoute(r);
                            setDialogUserId(u.id);
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
                          disabled={pending}
                          onClick={() => {
                            const extra =
                              r.entryCount > 0
                                ? `\n\nこの経路で申請済みの ${r.entryCount} 日分の明細も削除されます。`
                                : "";
                            if (!confirm(`「${r.name}」を削除します。よろしいですか？${extra}`))
                              return;
                            run(() => deleteRouteAction(r.id));
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {users.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <RouteIcon className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground font-ui">
              対象の社員がいません。
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground font-ui">
        「無効化」すると社員の申請画面で選べなくなりますが、申請済みの明細は残ります。
        削除した場合はその経路の申請明細も一緒に削除されるため、金額が変わる点にご注意ください。
      </p>

      <AdminRouteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        route={dialogRoute}
        userId={dialogUserId}
        userName={users.find((u) => u.id === dialogUserId)?.name ?? ""}
        ratePerKm={ratePerKm}
        onSaved={(message) => {
          setFeedback({ kind: "success", message });
          router.refresh();
        }}
      />
    </div>
  );
}
