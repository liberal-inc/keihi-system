import Link from "next/link";
import { BookText } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { canCommentOnReports, isAdminLike, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toMonthKey } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma";
import { MonthFilter } from "./month-filter";
import { ReportCard } from "./report-card";

export const metadata = { title: "日報一覧 | 経費管理システム" };

/** 月の範囲（[月初, 翌月初)）を返す */
function monthRange(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return {
    gte: new Date(Date.UTC(y, m - 1, 1)),
    lt: new Date(Date.UTC(y, m, 1)),
  };
}

export default async function ReportsPage({
  searchParams,
}: PageProps<"/reports">) {
  const user = await requireUser();
  const params = await searchParams;

  const rawMonth = typeof params.month === "string" ? params.month : "";
  const monthKey = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : "";
  const scope = params.scope === "team" ? "team" : "mine";

  // マネージャーは担当部署の社員の日報も閲覧できる（提出済みのみ）
  const canViewTeam =
    Boolean(user.managedDepartmentId) || isAdminLike(user.role);

  const where: Prisma.DailyReportWhereInput =
    scope === "team" && canViewTeam
      ? isAdminLike(user.role)
        ? { status: "submitted" }
        : {
            status: "submitted",
            user: { departmentId: user.managedDepartmentId },
          }
      : { userId: user.id };

  if (monthKey) where.reportDate = monthRange(monthKey);

  const reports = await prisma.dailyReport.findMany({
    where,
    orderBy: { reportDate: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });

  const currentMonth = toMonthKey(new Date());

  return (
    <>
      <PageHeader
        title="日報一覧"
        description={
          scope === "team"
            ? "担当部署の社員が提出した日報です。"
            : "自分が作成した日報の一覧です。"
        }
        action={
          user.role === "user" ? (
            <Button asChild variant="secondary">
              <Link href="/reports/new">日報を書く</Link>
            </Button>
          ) : undefined
        }
      />

      <MonthFilter
        monthKey={monthKey}
        currentMonth={currentMonth}
        scope={scope}
        canViewTeam={canViewTeam}
      />

      {reports.length === 0 ? (
        <Card className="mt-5">
          <CardContent className="py-14 text-center">
            <BookText className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground font-ui">
              該当する日報がありません。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={{
                id: r.id,
                authorName: r.user.name,
                isOwn: r.user.id === user.id,
                reportDate: r.reportDate.toISOString().slice(0, 10),
                content: r.content,
                reflection: r.reflection,
                nextPlan: r.nextPlan,
                status: r.status,
                comments: r.comments.map((c) => ({
                  id: c.id,
                  authorName: c.author.name,
                  isOwnComment: c.author.id === user.id,
                  body: c.body,
                  createdAt: c.createdAt.toISOString(),
                })),
              }}
              canComment={canCommentOnReports(user.role)}
            />
          ))}
        </div>
      )}
    </>
  );
}
