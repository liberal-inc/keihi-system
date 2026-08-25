"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const nameSchema = z.string().trim().min(1, "部署名を入力してください").max(60);

function revalidateDepartments() {
  revalidatePath("/admin/departments");
  revalidatePath("/admin/users");
  revalidatePath("/admin/routes");
  revalidatePath("/reports");
}

export async function createDepartmentAction(
  name: string,
): Promise<ActionResult> {
  await requireRole("admin", "owner");

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力を確認してください" };
  }

  const existing = await prisma.department.findUnique({
    where: { name: parsed.data },
  });
  if (existing) return { ok: false, error: "同じ名前の部署がすでにあります" };

  await prisma.department.create({ data: { name: parsed.data } });
  revalidateDepartments();
  return { ok: true, message: `部署「${parsed.data}」を追加しました` };
}

export async function renameDepartmentAction(
  departmentId: string,
  name: string,
): Promise<ActionResult> {
  await requireRole("admin", "owner");

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力を確認してください" };
  }

  const duplicate = await prisma.department.findFirst({
    where: { name: parsed.data, NOT: { id: departmentId } },
  });
  if (duplicate) return { ok: false, error: "同じ名前の部署がすでにあります" };

  const updated = await prisma.department.updateMany({
    where: { id: departmentId },
    data: { name: parsed.data },
  });
  if (updated.count === 0) return { ok: false, error: "部署が見つかりません" };

  revalidateDepartments();
  return { ok: true, message: `部署名を「${parsed.data}」に変更しました` };
}

export async function deleteDepartmentAction(
  departmentId: string,
): Promise<ActionResult> {
  await requireRole("admin", "owner");

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    include: { _count: { select: { members: true } } },
  });
  if (!department) return { ok: false, error: "部署が見つかりません" };

  // メンバーの departmentId は SetNull になるため、社員自体は消えない
  await prisma.department.delete({ where: { id: departmentId } });

  revalidateDepartments();
  return {
    ok: true,
    message:
      `部署「${department.name}」を削除しました` +
      (department._count.members > 0
        ? `（所属していた ${department._count.members} 名は「部署なし」になりました）`
        : ""),
  };
}

/** 部署へのメンバー追加・移動 */
export async function assignMemberAction(
  userId: string,
  departmentId: string | null,
): Promise<ActionResult> {
  await requireRole("admin", "owner");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { managedDepartment: { select: { id: true, name: true } } },
  });
  if (!user) return { ok: false, error: "社員が見つかりません" };

  // 担当部署のマネージャーが別部署に移ると管理関係が壊れるため、先に外させる
  if (
    user.managedDepartment &&
    user.managedDepartment.id !== departmentId
  ) {
    return {
      ok: false,
      error: `${user.name} さんは「${user.managedDepartment.name}」のマネージャーです。先にマネージャー設定を解除してください`,
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { departmentId },
  });

  revalidateDepartments();
  return {
    ok: true,
    message: departmentId
      ? `${user.name} さんを異動しました`
      : `${user.name} さんを部署なしにしました`,
  };
}

/** 部署のマネージャーを設定・解除する */
export async function setManagerAction(
  departmentId: string,
  userId: string | null,
): Promise<ActionResult> {
  await requireRole("admin", "owner");

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
  });
  if (!department) return { ok: false, error: "部署が見つかりません" };

  if (userId === null) {
    await prisma.department.update({
      where: { id: departmentId },
      data: { managerId: null },
    });
    revalidateDepartments();
    return { ok: true, message: `「${department.name}」のマネージャーを解除しました` };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "社員が見つかりません" };

  // マネージャーは担当部署の日報を見るため、その部署に所属している必要がある
  if (user.departmentId !== departmentId) {
    return {
      ok: false,
      error: `${user.name} さんは「${department.name}」に所属していません。先に異動させてください`,
    };
  }

  // 1人が複数部署のマネージャーを兼任することは想定しない（スキーマ上も1対1）
  const alreadyManaging = await prisma.department.findFirst({
    where: { managerId: userId, NOT: { id: departmentId } },
  });
  if (alreadyManaging) {
    return {
      ok: false,
      error: `${user.name} さんはすでに「${alreadyManaging.name}」のマネージャーです`,
    };
  }

  await prisma.department.update({
    where: { id: departmentId },
    data: { managerId: userId },
  });

  revalidateDepartments();
  return {
    ok: true,
    message: `「${department.name}」のマネージャーを ${user.name} さんにしました`,
  };
}
