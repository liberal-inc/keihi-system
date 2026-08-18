import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserManager } from "./user-manager";

export const metadata = { title: "社員管理 | 経費管理システム" };

export default async function UsersPage() {
  const actor = await requireRole("admin", "owner");

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { employeeNo: "asc" }, { createdAt: "asc" }],
      include: {
        department: { select: { name: true } },
        _count: { select: { applications: true, dailyReports: true } },
      },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="社員管理"
        description="社員の追加・編集・削除を行います。ログインは「ログイン名」の入力のみです。"
      />
      <UserManager
        actorId={actor.id}
        actorRole={actor.role}
        users={users.map((u) => ({
          id: u.id,
          loginName: u.loginName,
          name: u.name,
          employeeNo: u.employeeNo,
          email: u.email,
          role: u.role,
          departmentId: u.departmentId,
          departmentName: u.department?.name ?? null,
          isActive: u.isActive,
          applicationCount: u._count.applications,
          reportCount: u._count.dailyReports,
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      />
    </>
  );
}
