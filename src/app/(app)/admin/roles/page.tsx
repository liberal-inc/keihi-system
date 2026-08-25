import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RoleManager } from "./role-manager";

export const metadata = { title: "ロール管理 | 経費管理システム" };

export default async function RolesPage() {
  const actor = await requireRole("admin", "owner");

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { employeeNo: "asc" }, { createdAt: "asc" }],
    include: {
      department: { select: { name: true } },
      managedDepartment: { select: { name: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="ロール管理"
        description="全社員のロールを確認できます。変更はオーナーのみ実行できます。"
      />
      <RoleManager
        actorId={actor.id}
        canChange={actor.role === "owner"}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          loginName: u.loginName,
          employeeNo: u.employeeNo,
          role: u.role,
          departmentName: u.department?.name ?? null,
          managedDepartmentName: u.managedDepartment?.name ?? null,
          isActive: u.isActive,
        }))}
      />
    </>
  );
}
