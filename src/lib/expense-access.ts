import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth-types";
import type { Prisma } from "@/generated/prisma";

/**
 * 経費申請に対する閲覧・操作の範囲。
 * 仕様書「削除権限」に合わせる。
 *   オーナー   : 全社員
 *   管理者     : 自分が担当する部署の社員（= 所属部署のメンバー）+ 自分
 *   社員/マネージャー: 自分のみ
 */
export function expenseScopeWhere(
  user: SessionUser,
): Prisma.ExpenseApplicationWhereInput {
  if (user.role === "owner") return {};

  if (user.role === "admin") {
    // 部署未所属の管理者は自分の申請のみ扱える
    if (!user.departmentId) return { userId: user.id };
    return {
      OR: [{ userId: user.id }, { user: { departmentId: user.departmentId } }],
    };
  }

  return { userId: user.id };
}

/** 指定の申請に対する権限があるかを確認しつつ取得する */
export async function findAccessibleApplication(
  user: SessionUser,
  applicationId: string,
) {
  return prisma.expenseApplication.findFirst({
    where: { AND: [{ id: applicationId }, expenseScopeWhere(user)] },
    include: {
      user: {
        select: {
          name: true,
          employeeNo: true,
          department: { select: { name: true } },
        },
      },
      commuteEntries: { orderBy: { date: "asc" } },
      itemEntries: { orderBy: { createdAt: "asc" } },
      freeItemEntries: { orderBy: { createdAt: "asc" } },
    },
  });
}

export type AccessibleApplication = NonNullable<
  Awaited<ReturnType<typeof findAccessibleApplication>>
>;
