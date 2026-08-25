"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const roleSchema = z.enum(["owner", "admin", "manager", "user"]);

/**
 * ロールの変更。
 * 仕様書「ロール変更はオーナーのみが実行できます」に従い、owner に限定する。
 */
export async function changeRoleAction(
  userId: string,
  role: string,
): Promise<ActionResult> {
  const actor = await requireRole("owner");

  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "ロールの指定が不正です" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "社員が見つかりません" };
  if (target.role === parsed.data) {
    return { ok: false, error: "すでにそのロールです" };
  }

  // 自分自身をオーナーから降ろすと、以後ロール変更ができなくなる
  if (actor.id === userId && parsed.data !== "owner") {
    return {
      ok: false,
      error: "自分自身のオーナー権限は外せません。先に別の社員をオーナーにしてください",
    };
  }

  // 最後のオーナーを降格させない
  if (target.role === "owner" && parsed.data !== "owner") {
    const owners = await prisma.user.count({
      where: { role: "owner", isActive: true },
    });
    if (owners <= 1) {
      return { ok: false, error: "オーナーが不在になるため変更できません" };
    }
  }

  // マネージャーを外すときは、担当部署の設定も解除する
  if (target.role === "manager" && parsed.data !== "manager") {
    await prisma.department.updateMany({
      where: { managerId: userId },
      data: { managerId: null },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: parsed.data },
  });

  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
  revalidatePath("/admin/departments");

  return { ok: true, message: `${target.name} さんのロールを変更しました` };
}
