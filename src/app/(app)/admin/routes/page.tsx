import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth";
import { scopeLabel, userScopeWhere } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { getRatePerKm } from "@/lib/settings";
import { RouteManager } from "./route-manager";

export const metadata = { title: "通勤経路設定 | 経費管理システム" };

export default async function AdminRoutesPage() {
  const actor = await requireRole("admin", "owner");
  const scope = userScopeWhere(actor);

  const [users, ratePerKm] = await Promise.all([
    prisma.user.findMany({
      where: scope,
      orderBy: [{ employeeNo: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        employeeNo: true,
        department: { select: { name: true } },
        routes: {
          orderBy: { createdAt: "asc" },
          include: { _count: { select: { entries: true } } },
        },
      },
    }),
    getRatePerKm(),
  ]);

  return (
    <>
      <PageHeader
        title="通勤経路設定"
        description={`${scopeLabel(actor)}の通勤経路を確認・追加・編集・削除できます。`}
      />
      <RouteManager
        ratePerKm={ratePerKm}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          employeeNo: u.employeeNo,
          departmentName: u.department?.name ?? null,
          routes: u.routes.map((r) => ({
            id: r.id,
            userId: r.userId,
            name: r.name,
            originName: r.originName,
            destName: r.destName,
            transportType: r.transportType,
            dailyFare: r.dailyFare,
            distanceKm: r.distanceKm,
            isActive: r.isActive,
            entryCount: r._count.entries,
          })),
        }))}
      />
    </>
  );
}
