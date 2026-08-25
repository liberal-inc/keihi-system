"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { canManageUser } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const routeSchema = z
  .object({
    id: z.string().optional(),
    userId: z.string().min(1, "社員を選択してください"),
    name: z.string().trim().min(1, "経路名を入力してください").max(80),
    originName: z.string().trim().min(1, "出発地を入力してください").max(200),
    destName: z.string().trim().min(1, "到着地を入力してください").max(200),
    transportType: z.enum(["public_transit", "car"]),
    dailyFare: z.number().int().min(0).max(1_000_000).nullable(),
    distanceKm: z.number().min(0).max(1000).nullable(),
    isActive: z.boolean(),
  })
  .refine(
    (v) =>
      v.transportType !== "public_transit" ||
      (v.dailyFare !== null && v.dailyFare > 0),
    { message: "公共交通の場合は1日あたりの金額（往復）を入力してください" },
  )
  .refine(
    (v) => v.transportType !== "car" || (v.distanceKm !== null && v.distanceKm > 0),
    { message: "車通勤の場合は片道距離(km)を入力してください" },
  );

export type AdminRouteInput = z.input<typeof routeSchema>;

function revalidateRoutes() {
  revalidatePath("/admin/routes");
  revalidatePath("/expenses/new");
}

type ScopeCheck =
  | { ok: false; error: string }
  | { ok: true; target: { id: string; departmentId: string | null; name: string } };

/** 対象社員が自分の管理範囲かを確認する */
async function assertScope(userId: string): Promise<ScopeCheck> {
  const actor = await requireRole("admin", "owner");
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, departmentId: true, name: true },
  });
  if (!target) return { ok: false, error: "社員が見つかりません" };
  if (!canManageUser(actor, target)) {
    return { ok: false, error: "この社員を操作する権限がありません" };
  }
  return { ok: true, target };
}

export async function saveRouteAction(
  input: AdminRouteInput,
): Promise<ActionResult> {
  const actor = await requireRole("admin", "owner");

  const parsed = routeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
    };
  }
  const d = parsed.data;

  const scope = await assertScope(d.userId);
  if (!scope.ok) return scope;

  const data = {
    name: d.name,
    originName: d.originName,
    destName: d.destName,
    transportType: d.transportType,
    // 交通手段に対応しない項目は保持しない
    dailyFare: d.transportType === "public_transit" ? d.dailyFare : null,
    distanceKm: d.transportType === "car" ? d.distanceKm : null,
    isActive: d.isActive,
  };

  if (d.id) {
    const existing = await prisma.commuteRoute.findUnique({
      where: { id: d.id },
      select: { userId: true },
    });
    if (!existing) return { ok: false, error: "経路が見つかりません" };

    // 経路の持ち主を移し替えることは想定しない
    if (existing.userId !== d.userId) {
      return { ok: false, error: "経路の所有者は変更できません" };
    }

    await prisma.commuteRoute.update({ where: { id: d.id }, data });
    revalidateRoutes();
    return { ok: true, message: `「${d.name}」を更新しました` };
  }

  await prisma.commuteRoute.create({ data: { ...data, userId: d.userId } });
  revalidateRoutes();
  return {
    ok: true,
    message: `${scope.target.name} さんの経路「${d.name}」を追加しました`,
  };
}

export async function deleteRouteAction(routeId: string): Promise<ActionResult> {
  const actor = await requireRole("admin", "owner");

  const route = await prisma.commuteRoute.findUnique({
    where: { id: routeId },
    include: {
      user: { select: { id: true, departmentId: true, name: true } },
      _count: { select: { entries: true } },
    },
  });
  if (!route) return { ok: false, error: "経路が見つかりません" };
  if (!canManageUser(actor, route.user)) {
    return { ok: false, error: "この経路を操作する権限がありません" };
  }

  await prisma.commuteRoute.delete({ where: { id: routeId } });

  revalidateRoutes();
  return {
    ok: true,
    message:
      `「${route.name}」を削除しました` +
      (route._count.entries > 0
        ? `（この経路の申請明細 ${route._count.entries} 件も削除されました）`
        : ""),
  };
}

export async function toggleRouteAction(routeId: string): Promise<ActionResult> {
  const actor = await requireRole("admin", "owner");

  const route = await prisma.commuteRoute.findUnique({
    where: { id: routeId },
    include: { user: { select: { id: true, departmentId: true } } },
  });
  if (!route) return { ok: false, error: "経路が見つかりません" };
  if (!canManageUser(actor, route.user)) {
    return { ok: false, error: "この経路を操作する権限がありません" };
  }

  await prisma.commuteRoute.update({
    where: { id: routeId },
    data: { isActive: !route.isActive },
  });

  revalidateRoutes();
  return {
    ok: true,
    message: `「${route.name}」を${route.isActive ? "無効" : "有効"}にしました`,
  };
}
