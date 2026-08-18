import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRatePerKm } from "@/lib/settings";
import { monthKeyToDate, toMonthKey } from "@/lib/utils";
import { ExpenseWorkspace } from "./expense-workspace";

export const metadata = { title: "経費申請 | 経費管理システム" };

export default async function NewExpensePage({
  searchParams,
}: PageProps<"/expenses/new">) {
  const user = await requireUser();
  const params = await searchParams;

  const raw = typeof params.month === "string" ? params.month : "";
  const monthKey = /^\d{4}-\d{2}$/.test(raw) ? raw : toMonthKey(new Date());

  const [routes, categories, ratePerKm, draft, claimedEntries] = await Promise.all([
    prisma.commuteRoute.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.itemCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    getRatePerKm(),
    prisma.expenseApplication.findFirst({
      where: { userId: user.id, targetMonth: monthKeyToDate(monthKey), status: "draft" },
      orderBy: { createdAt: "desc" },
      include: {
        commuteEntries: { orderBy: { date: "asc" } },
        itemEntries: { orderBy: { createdAt: "asc" } },
        freeItemEntries: { orderBy: { createdAt: "asc" } },
      },
    }),
    // 対象月にすでに申請済みの通勤日（提出済み含む全申請から収集）
    prisma.commuteEntry.findMany({
      where: {
        route: { userId: user.id },
        application: { targetMonth: monthKeyToDate(monthKey) },
      },
      select: { routeId: true, date: true },
    }),
  ]);

  const claimedByRoute: Record<string, string[]> = {};
  for (const e of claimedEntries) {
    const key = e.date.toISOString().slice(0, 10);
    (claimedByRoute[e.routeId] ??= []).push(key);
  }

  return (
    <>
      <PageHeader
        title="経費申請"
        description="月を選択して通勤費・小物購入費を申請します。同じ月に何度でも追加提出できます。"
      />
      <ExpenseWorkspace
        monthKey={monthKey}
        ratePerKm={ratePerKm}
        routes={routes.map((r) => ({
          id: r.id,
          name: r.name,
          originName: r.originName,
          destName: r.destName,
          transportType: r.transportType,
          dailyFare: r.dailyFare,
          distanceKm: r.distanceKm,
        }))}
        claimedByRoute={claimedByRoute}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          unitCost: c.unitCost,
          unit: c.unit,
        }))}
        draft={
          draft && {
            id: draft.id,
            commuteEntries: draft.commuteEntries.map((e) => ({
              id: e.id,
              date: e.date.toISOString().slice(0, 10),
              routeName: e.routeNameSnapshot,
              amount: e.amount,
            })),
            itemEntries: draft.itemEntries.map((e) => ({
              id: e.id,
              name: e.nameSnapshot,
              quantity: e.quantity,
              unit: e.unitSnapshot,
              amount: e.amount,
            })),
            freeItemEntries: draft.freeItemEntries.map((e) => ({
              id: e.id,
              name: e.name,
              amount: e.amount,
              hasReceipt: Boolean(e.receiptKey),
            })),
          }
        }
      />
    </>
  );
}
