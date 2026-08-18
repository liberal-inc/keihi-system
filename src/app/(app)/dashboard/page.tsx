import Link from "next/link";
import { BookText, CalendarDays, Receipt, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatJpMonth, formatYen, monthKeyToDate, toMonthKey } from "@/lib/utils";

export const metadata = { title: "ダッシュボード | 経費管理システム" };

/** 申請 1 件の合計金額 */
type WithEntries = {
  commuteEntries: { amount: number }[];
  itemEntries: { amount: number }[];
  freeItemEntries: { amount: number }[];
};

function totalOf(app: WithEntries): number {
  return (
    app.commuteEntries.reduce((s, e) => s + e.amount, 0) +
    app.itemEntries.reduce((s, e) => s + e.amount, 0) +
    app.freeItemEntries.reduce((s, e) => s + e.amount, 0)
  );
}

const AMOUNTS = {
  commuteEntries: { select: { amount: true } },
  itemEntries: { select: { amount: true } },
  freeItemEntries: { select: { amount: true } },
} as const;

export default async function DashboardPage() {
  const user = await requireUser();

  const now = new Date();
  const thisMonth = toMonthKey(now);
  const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));
  const nextYearStart = new Date(Date.UTC(now.getFullYear() + 1, 0, 1));

  const [thisMonthApps, thisYearApps, recentApps, draftReports, recentReports] =
    await Promise.all([
      prisma.expenseApplication.findMany({
        where: { userId: user.id, targetMonth: monthKeyToDate(thisMonth) },
        include: AMOUNTS,
      }),
      prisma.expenseApplication.findMany({
        where: {
          userId: user.id,
          targetMonth: { gte: yearStart, lt: nextYearStart },
        },
        include: AMOUNTS,
      }),
      prisma.expenseApplication.findMany({
        where: { userId: user.id },
        orderBy: [{ targetMonth: "desc" }, { createdAt: "desc" }],
        take: 5,
        include: AMOUNTS,
      }),
      prisma.dailyReport.count({ where: { userId: user.id, status: "draft" } }),
      prisma.dailyReport.findMany({
        where: { userId: user.id },
        orderBy: { reportDate: "desc" },
        take: 5,
        select: { id: true, reportDate: true, status: true },
      }),
    ]);

  const thisMonthTotal = thisMonthApps.reduce((s, a) => s + totalOf(a), 0);
  const thisYearTotal = thisYearApps.reduce((s, a) => s + totalOf(a), 0);
  const submittedThisMonth = thisMonthApps.filter(
    (a) => a.status === "submitted",
  ).length;

  const stats = [
    {
      label: `${formatJpMonth(`${thisMonth}-01`)}の申請額`,
      value: formatYen(thisMonthTotal),
      sub: `提出済み ${submittedThisMonth} 件 / 全 ${thisMonthApps.length} 件`,
      icon: Receipt,
    },
    {
      label: `${now.getFullYear()}年の合計`,
      value: formatYen(thisYearTotal),
      sub: `${thisYearApps.length} 件の申請`,
      icon: TrendingUp,
    },
    {
      label: "今年の申請回数",
      value: `${thisYearApps.length} 回`,
      sub: "追加提出を含む",
      icon: CalendarDays,
    },
    {
      label: "日報の下書き",
      value: `${draftReports} 件`,
      sub: draftReports > 0 ? "提出をお忘れなく" : "未提出はありません",
      icon: BookText,
    },
  ];

  return (
    <>
      <PageHeader
        title={`おかえりなさい、${user.name} さん`}
        description="今月の申請状況と最近の記録です。"
        action={
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href="/reports/new">日報を書く</Link>
            </Button>
            <Button asChild>
              <Link href="/expenses/new">経費を申請する</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground font-ui">
                    {s.label}
                  </p>
                  <Icon className="size-4 shrink-0 text-muted-foreground/60" />
                </div>
                <p className="mt-2 font-display text-3xl font-semibold text-primary">
                  {s.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground font-ui">
                  {s.sub}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* 最近の申請 */}
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold font-ui">最近の申請</h2>
              <Link
                href="/expenses"
                className="text-xs text-primary underline-offset-2 hover:underline font-ui"
              >
                すべて見る
              </Link>
            </div>

            {recentApps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground font-ui">
                まだ申請がありません。
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentApps.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-sm font-ui">
                      {formatJpMonth(a.targetMonth.toISOString().slice(0, 7) + "-01")}
                      <StatusBadge status={a.status} />
                    </span>
                    <span className="text-sm font-medium font-ui">
                      {formatYen(totalOf(a))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 最近の日報 */}
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold font-ui">最近の日報</h2>
              <Link
                href="/reports"
                className="text-xs text-primary underline-offset-2 hover:underline font-ui"
              >
                すべて見る
              </Link>
            </div>

            {recentReports.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground font-ui">
                まだ日報がありません。
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentReports.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm font-ui"
                  >
                    <span>
                      {r.reportDate.toISOString().slice(0, 10).replace(/-/g, "/")}
                    </span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
