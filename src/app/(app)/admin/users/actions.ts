"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** 全角・半角スペースを除去する（ログイン時の入力と揃えるため） */
function normalizeLoginName(value: string): string {
  return value.replace(/[\s　]/g, "");
}

const userSchema = z.object({
  id: z.string().optional(),
  loginName: z.string().min(1, "ログイン名を入力してください").max(50),
  name: z.string().min(1, "氏名を入力してください").max(50),
  employeeNo: z.string().max(30).nullable(),
  email: z.string().email("メールアドレスの形式が正しくありません").nullable(),
  departmentId: z.string().nullable(),
  role: z.enum(["owner", "admin", "manager", "user"]),
  isActive: z.boolean(),
});

export type UserInput = z.input<typeof userSchema>;

export async function saveUserAction(input: UserInput): Promise<ActionResult> {
  const actor = await requireRole("admin", "owner");

  const parsed = userSchema.safeParse({
    ...input,
    loginName: normalizeLoginName(String(input.loginName ?? "")),
    employeeNo: input.employeeNo || null,
    email: input.email || null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
    };
  }
  const d = parsed.data;

  // ロールの変更・付与はオーナーのみ（仕様書「ロール変更はオーナーのみ」）
  const existing = d.id
    ? await prisma.user.findUnique({ where: { id: d.id } })
    : null;
  if (d.id && !existing) return { ok: false, error: "社員が見つかりません" };

  const roleChanged = existing ? existing.role !== d.role : d.role !== "user";
  if (roleChanged && actor.role !== "owner") {
    return { ok: false, error: "ロールの変更はオーナーのみ実行できます" };
  }

  // 最後のオーナーを降格・無効化させない
  if (existing?.role === "owner" && (d.role !== "owner" || !d.isActive)) {
    const owners = await prisma.user.count({
      where: { role: "owner", isActive: true },
    });
    if (owners <= 1) {
      return { ok: false, error: "オーナーが不在になるため変更できません" };
    }
  }

  const data = {
    loginName: d.loginName,
    name: d.name,
    employeeNo: d.employeeNo,
    email: d.email,
    departmentId: d.departmentId,
    role: d.role,
    isActive: d.isActive,
  };

  try {
    if (d.id) {
      await prisma.user.update({ where: { id: d.id }, data });
      revalidatePath("/admin/users");
      return { ok: true, message: `${d.name} さんの情報を更新しました` };
    }
    await prisma.user.create({ data });
    revalidatePath("/admin/users");
    return { ok: true, message: `${d.name} さんを追加しました` };
  } catch (e) {
    // ログイン名・社員番号・メールの一意制約違反
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return {
        ok: false,
        error:
          "ログイン名・社員番号・メールアドレスのいずれかがすでに使われています",
      };
    }
    throw e;
  }
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const actor = await requireRole("admin", "owner");

  if (actor.id === userId) {
    return { ok: false, error: "自分自身は削除できません" };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "社員が見つかりません" };

  // オーナーの削除はオーナーのみ
  if (target.role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "オーナーの削除はオーナーのみ実行できます" };
  }
  if (target.role === "owner") {
    const owners = await prisma.user.count({
      where: { role: "owner", isActive: true },
    });
    if (owners <= 1) {
      return { ok: false, error: "オーナーが不在になるため削除できません" };
    }
  }

  // 申請・日報も cascade で消えるため、画面側で警告してから呼ぶこと
  await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/admin/users");
  return { ok: true, message: `${target.name} さんを削除しました` };
}

/** 部署の新規追加（社員登録時にその場で作れるようにする） */
export async function createDepartmentAction(
  name: string,
): Promise<ActionResult> {
  await requireRole("admin", "owner");

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "部署名を入力してください" };

  const existing = await prisma.department.findUnique({
    where: { name: trimmed },
  });
  if (existing) return { ok: false, error: "同じ名前の部署がすでにあります" };

  await prisma.department.create({ data: { name: trimmed } });
  revalidatePath("/admin/users");
  return { ok: true, message: `部署「${trimmed}」を追加しました` };
}

/** 自分の表示名・ログイン名を変更する（全ロール共通） */
export async function updateOwnNameAction(
  loginName: string,
  name: string,
): Promise<ActionResult> {
  const user = await requireUser();

  const normalized = normalizeLoginName(loginName);
  if (!normalized) return { ok: false, error: "ログイン名を入力してください" };
  if (!name.trim()) return { ok: false, error: "氏名を入力してください" };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { loginName: normalized, name: name.trim() },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { ok: false, error: "そのログイン名はすでに使われています" };
    }
    throw e;
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "お名前を変更しました" };
}
