import Link from "next/link";
import { Download, FileStack } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { expenseScopeWhere } from "@/lib/expense-access";
import { prisma } from "@/lib/prisma";
import { formatJpDate, formatJpMonth, formatYen, monthKeyToDate, toMonthKey } from "@/lib/utils";
import { MonthPicker } from "./month-picker";

export const metadata = { title: "月次経費一覧 | 経費管理システム" };

export default async function MonthlyExpensePage({
  searchParams,
}: PageProps<"/admin/monthly">) {
  const user = await requireRole("admin", "owner");
  const params = await searchParams;

  const raw = typeof params.month === "string" ? params.month : "";
  const monthKey = /^\d{4}-\d{2}$/.test(raw) ? raw : toMonthKey(new Date());

  const applications = await prisma.expenseApplication.findMany({
    where: {
      AND: [{ targetMonth: monthKeyToDate(monthKey) }, expenseScopeWhere(user)],
    },
    orderBy: [{ user: { employeeNo: "asc" } }, { createdAt: "asc" }],
    include: {
      user: {
        select: {
          name: true,
          employeeNo: true,
          department: { select: { name: true } },
        },
      },
      commuteEntries: { select: { amount: true } },
      itemEntries: { select: { amount: true } },
      freeItemEntries: { select: { amount: true } },
    },
  });

  const withTotals = applications.map((a) => ({
    ...a,
    total:
      a.commuteEntries.reduce((s, e) => s + e.amount, 0) +
      a.itemEntries.reduce((s, e) => s + e.amount, 0) +
      a.freeItemEntries.reduce((s, e) => s + e.amount, 0),
    entryCount:
      a.commuteEntries.length + a.itemEntries.length + a.freeItemEntries.length,
  }));

  const grandTotal = withTotals.reduce((s, a) => s + a.total, 0);
  const submittedCount = withTotals.filter(
    (a) => a.status === "submitted",
  ).length;

  return (
    <>
      <PageHeader
        title="月次経費一覧"
        description={
          user.role === "owner"
            ? "全社員の申請を確認し、PDF を出力できます。"
            : "担当部署の社員の申請を確認し、PDF を出力できます。"
        }
        action={
          <Button asChild disabled={withTotals.length === 0}>
            <a href={`/api/expenses/pdf?month=${monthKey}`}>
              <Download className="size-4" />
              全件一括PDF出力
            </a>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <MonthPicker monthKey={monthKey} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          ["申請件数", `${withTotals.length} 件`],
          ["提出済み", `${submittedCount} 件`],
          ["合計金額", formatYen(grandTotal)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground font-ui">{label}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-primary">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {withTotals.length === 0 ? (
        <Card className="mt-5">
          <CardContent className="py-14 text-center">
            <FileStack className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground font-ui">
              {formatJpMonth(`${monthKey}-01`)}の申請はまだありません。
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-5">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {withTotals.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
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
                      {a.user.department?.name ?? "部署未設定"} · {a.entryCount} 件の明細
                      {a.submittedAt && ` · 提出日 ${formatJpDate(a.submittedAt)}`}
                    </p>
                  </div>

                  <span className="font-display text-xl font-semibold text-primary">
                    {formatYen(a.total)}
                  </span>

                  <Button asChild variant="secondary" size="sm">
                    <a href={`/api/expenses/${a.id}/pdf`}>
                      <Download className="size-3.5" />
                      PDF
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted-foreground font-ui">
        申請内容の詳細確認・削除は
        <Link href="/expenses" className="text-primary underline-offset-2 hover:underline">
          申請履歴
        </Link>
        （自分の申請）および今後追加する管理ダッシュボードから行えます。
      </p>
    </>
  );
}
