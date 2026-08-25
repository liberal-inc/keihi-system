import Link from "next/link";
import { Download, FileStack, Users, Wallet } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { scopeLabel, userScopeWhere } from "@/lib/admin-access";
import { expenseScopeWhere } from "@/lib/expense-access";
import { prisma } from "@/lib/prisma";
import {
  formatJpDate,
  formatJpMonth,
  formatYen,
  monthKeyToDate,
  toMonthKey,
} from "@/lib/utils";

export const metadata = { title: "管理ダッシュボード | 経費管理システム" };

type WithAmounts = {
  commuteEntries: { amount: number }[];
  itemEntries: { amount: number }[];
  freeItemEntries: { amount: number }[];
};

function totalOf(a: WithAmounts): number {
  return (
    a.commuteEntries.reduce((s, e) => s + e.amount, 0) +
    a.itemEntries.reduce((s, e) => s + e.amount, 0) +
    a.freeItemEntries.reduce((s, e) => s + e.amount, 0)
  );
}

const AMOUNTS = {
  commuteEntries: { select: { amount: true } },
  itemEntries: { select: { amount: true } },
  freeItemEntries: { select: { amount: true } },
} as const;

export default async function AdminDashboardPage() {
  const actor = await requireRole("admin", "owner");

  const thisMonth = toMonthKey(new Date());
  const scope = expenseScopeWhere(actor);

  const [applications, memberCount, draftReports] = await Promise.all([
    prisma.expenseApplication.findMany({
      where: { AND: [{ targetMonth: monthKeyToDate(thisMonth) }, scope] },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      include: {
        ...AMOUNTS,
        user: {
          select: {
            name: true,
            employeeNo: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.count({ where: userScopeWhere(actor) }),
    prisma.dailyReport.count({
      where: {
        status: "draft",
        user: userScopeWhere(actor),
      },
    }),
  ]);

  const submitted = applications.filter((a) => a.status === "submitted");
  const totalAmount = applications.reduce((s, a) => s + totalOf(a), 0);

  const stats = [
    {
      label: `${formatJpMonth(`${thisMonth}-01`)}の申請件数`,
      value: `${applications.length} 件`,
      sub: `提出済み ${submitted.length} 件 / 下書き ${applications.length - submitted.length} 件`,
      icon: FileStack,
    },
    {
      label: "当月の合計金額",
      value: formatYen(totalAmount),
      sub: `${scopeLabel(actor)}の合計`,
      icon: Wallet,
    },
    {
      label: "提出済み件数",
      value: `${submitted.length} 件`,
      sub:
        applications.length > 0
          ? `提出率 ${Math.round((submitted.length / applications.length) * 100)}%`
          : "申請なし",
      icon: FileStack,
    },
    {
      label: "対象社員数",
      value: `${memberCount} 名`,
      sub: draftReports > 0 ? `日報の下書き ${draftReports} 件` : "日報の未提出なし",
      icon: Users,
    },
  ];

  return (
    <>
      <PageHeader
        title="管理ダッシュボード"
        description={`${formatJpMonth(`${thisMonth}-01`)}の${scopeLabel(actor)}の申請状況です。`}
        action={
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href="/admin/monthly">月次経費一覧</Link>
            </Button>
            <Button asChild>
              <a href={`/api/expenses/pdf?month=${thisMonth}`}>
                <Download className="size-4" />
                当月分を一括PDF
              </a>
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

      <Card className="mt-6">
        <CardContent className="pt-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold font-ui">当月の申請一覧</h2>
            <Link
              href="/admin/monthly"
              className="text-xs text-primary underline-offset-2 hover:underline font-ui"
            >
              月を切り替えて見る
            </Link>
          </div>

          {applications.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground font-ui">
              {formatJpMonth(`${thisMonth}-01`)}の申請はまだありません。
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {applications.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium font-ui">{a.user.name}</span>
                      {a.user.employeeNo && (
                        <span className="text-xs text-muted-foreground font-ui">
                          No.{a.user.employeeNo}
                        </span>
                      )}
                      <StatusBadge status={a.status} />
                    </p>
                    <p className="text-xs text-muted-foreground font-ui">
                      {a.user.department?.name ?? "部署未設定"}
                      {a.submittedAt && ` · 提出日 ${formatJpDate(a.submittedAt)}`}
                    </p>
                  </div>

                  <span className="font-medium font-ui">
                    {formatYen(totalOf(a))}
                  </span>

                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/expenses/${a.id}/pdf`}>
                      <Download className="size-3.5" />
                      PDF
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
