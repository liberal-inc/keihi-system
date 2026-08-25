import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DepartmentManager } from "./department-manager";

export const metadata = { title: "部署管理 | 経費管理システム" };

export default async function DepartmentsPage() {
  await requireRole("admin", "owner");

  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        manager: { select: { id: true, name: true } },
        members: {
          orderBy: [{ employeeNo: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true, employeeNo: true, role: true },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: [{ employeeNo: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        employeeNo: true,
        role: true,
        departmentId: true,
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="部署管理"
        description="部署の追加・編集・削除、メンバーの異動、マネージャーの設定ができます。"
      />
      <DepartmentManager
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          managerId: d.managerId,
          managerName: d.manager?.name ?? null,
          members: d.members.map((m) => ({
            id: m.id,
            name: m.name,
            employeeNo: m.employeeNo,
            role: m.role,
          })),
        }))}
        unassigned={users
          .filter((u) => u.departmentId === null)
          .map((u) => ({
            id: u.id,
            name: u.name,
            employeeNo: u.employeeNo,
            role: u.role,
          }))}
      />
    </>
  );
}
