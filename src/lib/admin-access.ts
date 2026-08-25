import "server-only";

import type { SessionUser } from "@/lib/auth-types";
import type { Prisma } from "@/generated/prisma";

/**
 * 管理画面で「どの社員を扱えるか」の範囲。
 * 経費申請の削除権限（src/lib/expense-access.ts）と同じ考え方に揃える。
 *   オーナー : 全社員
 *   管理者   : 自分が所属する部署の社員 + 自分
 */
export function userScopeWhere(user: SessionUser): Prisma.UserWhereInput {
  if (user.role === "owner") return {};

  if (user.role === "admin") {
    if (!user.departmentId) return { id: user.id };
    return {
      OR: [{ id: user.id }, { departmentId: user.departmentId }],
    };
  }

  return { id: user.id };
}

/** 対象の社員を操作できるかを判定する */
export function canManageUser(
  actor: SessionUser,
  target: { id: string; departmentId: string | null },
): boolean {
  if (actor.role === "owner") return true;
  if (actor.role !== "admin") return false;
  if (target.id === actor.id) return true;
  return Boolean(actor.departmentId) && target.departmentId === actor.departmentId;
}

/** 画面の説明文に使う、スコープの言い回し */
export function scopeLabel(user: SessionUser): string {
  return user.role === "owner" ? "全社員" : "担当部署の社員";
}
