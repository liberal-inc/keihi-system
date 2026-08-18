import Link from "next/link";
import { FileStack } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApplicationCard } from "./application-card";

export const metadata = { title: "申請履歴 | 経費管理システム" };

export default async function ExpenseHistoryPage() {
  const user = await requireUser();

  const applications = await prisma.expenseApplication.findMany({
    where: { userId: user.id },
    orderBy: [{ targetMonth: "desc" }, { createdAt: "desc" }],
    include: {
      commuteEntries: { orderBy: { date: "asc" } },
      itemEntries: { orderBy: { createdAt: "asc" } },
      freeItemEntries: { orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <>
      <PageHeader
        title="申請履歴"
        description="過去の経費申請の内容を確認・削除できます。"
        action={
          <Button asChild variant="secondary">
            <Link href="/expenses/new">新しく申請する</Link>
          </Button>
        }
      />

      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <FileStack className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground font-ui">
              まだ申請がありません。
            </p>
            <Button asChild className="mt-4">
              <Link href="/expenses/new">経費を申請する</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {applications.map((app) => (
            <ApplicationCard
              key={app.id}
              application={{
                id: app.id,
                monthKey: app.targetMonth.toISOString().slice(0, 7),
                status: app.status,
                submittedAt: app.submittedAt?.toISOString() ?? null,
                commuteEntries: app.commuteEntries.map((e) => ({
                  id: e.id,
                  date: e.date.toISOString().slice(0, 10),
                  routeName: e.routeNameSnapshot,
                  amount: e.amount,
                })),
                itemEntries: app.itemEntries.map((e) => ({
                  id: e.id,
                  name: e.nameSnapshot,
                  quantity: e.quantity,
                  unit: e.unitSnapshot,
                  amount: e.amount,
                })),
                freeItemEntries: app.freeItemEntries.map((e) => ({
                  id: e.id,
                  name: e.name,
                  amount: e.amount,
                  hasReceipt: Boolean(e.receiptKey),
                })),
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
