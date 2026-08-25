"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeDailyFare } from "@/lib/commute";
import { getRatePerKm } from "@/lib/settings";
import {
  MAX_RECEIPT_BYTES,
  deleteReceipt,
  isSupportedReceipt,
  putReceipt,
} from "@/lib/storage";
import { dateKeyToDate, monthKeyToDate } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const monthKeyRe = /^\d{4}-\d{2}$/;
const dateKeyRe = /^\d{4}-\d{2}-\d{2}$/;

/** 領収書の保存に失敗したときの利用者向けメッセージ */
function storageErrorMessage(e: unknown): string {
  console.error("領収書の保存に失敗しました", e);
  if (
    e instanceof Error &&
    (e.message.includes("Cloudflare R2") || e.message.includes("読み込めませんでした"))
  ) {
    return e.message;
  }
  return "領収書の保存に失敗しました。時間をおいて再度お試しください。";
}

function revalidateExpenses() {
  revalidatePath("/expenses");
  revalidatePath("/expenses/new");
  revalidatePath("/dashboard");
}

/* ------------------------------------------------------------------ */
/* 通勤経路の登録・編集・削除                                          */
/* ------------------------------------------------------------------ */

const routeSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "経路名を入力してください").max(80),
    originName: z.string().trim().min(1, "出発地を入力してください").max(200),
    destName: z.string().trim().min(1, "到着地を入力してください").max(200),
    transportType: z.enum(["public_transit", "car"]),
    dailyFare: z.number().int().min(0).max(1_000_000).nullable(),
    distanceKm: z.number().min(0).max(1000).nullable(),
    originLat: z.number().nullable(),
    originLng: z.number().nullable(),
    destLat: z.number().nullable(),
    destLng: z.number().nullable(),
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

export type RouteInput = z.input<typeof routeSchema>;

export async function saveRouteAction(input: RouteInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = routeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }
  const d = parsed.data;

  const data = {
    name: d.name,
    originName: d.originName,
    destName: d.destName,
    transportType: d.transportType,
    // 交通手段に対応しない項目は保持しない
    dailyFare: d.transportType === "public_transit" ? d.dailyFare : null,
    distanceKm: d.transportType === "car" ? d.distanceKm : null,
    originLat: d.originLat,
    originLng: d.originLng,
    destLat: d.destLat,
    destLng: d.destLng,
  };

  if (d.id) {
    // 他人の経路を書き換えられないよう userId で絞り込む
    const updated = await prisma.commuteRoute.updateMany({
      where: { id: d.id, userId: user.id },
      data,
    });
    if (updated.count === 0) return { ok: false, error: "経路が見つかりません" };
    revalidateExpenses();
    return { ok: true, message: "経路を更新しました" };
  }

  await prisma.commuteRoute.create({ data: { ...data, userId: user.id } });
  revalidateExpenses();
  return { ok: true, message: "経路を登録しました" };
}

export async function deleteRouteAction(routeId: string): Promise<ActionResult> {
  const user = await requireUser();
  const deleted = await prisma.commuteRoute.deleteMany({
    where: { id: routeId, userId: user.id },
  });
  if (deleted.count === 0) return { ok: false, error: "経路が見つかりません" };
  revalidateExpenses();
  return { ok: true, message: "経路を削除しました" };
}

/* ------------------------------------------------------------------ */
/* 申請の取得・作成（同じ月に何度でも追加提出できる）                    */
/* ------------------------------------------------------------------ */

/**
 * 指定月の「作成中(draft)」申請を取得、無ければ作成する。
 * 提出済みの申請はそのまま残るため、同じ月に何度でも追加提出できる。
 */
async function getOrCreateDraft(userId: string, monthKey: string) {
  const targetMonth = monthKeyToDate(monthKey);

  const existing = await prisma.expenseApplication.findFirst({
    where: { userId, targetMonth, status: "draft" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.expenseApplication.create({
    data: { userId, targetMonth, status: "draft" },
  });
}

/* ------------------------------------------------------------------ */
/* 通勤費の申請（出勤日を複数選択して提出）                             */
/* ------------------------------------------------------------------ */

const commuteSubmitSchema = z.object({
  monthKey: z.string().regex(monthKeyRe, "対象月が不正です"),
  routeId: z.string().min(1, "経路を選択してください"),
  dateKeys: z
    .array(z.string().regex(dateKeyRe))
    .min(1, "出勤日を1日以上選択してください"),
});

export async function submitCommuteAction(
  input: z.input<typeof commuteSubmitSchema>,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = commuteSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }
  const { monthKey, routeId, dateKeys } = parsed.data;

  const route = await prisma.commuteRoute.findFirst({
    where: { id: routeId, userId: user.id },
  });
  if (!route) return { ok: false, error: "経路が見つかりません" };

  // 選択日がすべて対象月に属することを確認する
  if (dateKeys.some((k) => k.slice(0, 7) !== monthKey)) {
    return { ok: false, error: "対象月に含まれない日付が選択されています" };
  }

  const ratePerKm = await getRatePerKm();
  const amount = routeDailyFare(route, ratePerKm);
  if (amount <= 0) {
    return { ok: false, error: "この経路の交通費が 0 円です。経路設定を確認してください" };
  }

  // すでに申請済みの日付を除外する（仕様: 既存の日付は保持し、新しい日付だけを追加）
  const already = await prisma.commuteEntry.findMany({
    where: { routeId: route.id, date: { in: dateKeys.map(dateKeyToDate) } },
    select: { date: true },
  });
  const alreadyKeys = new Set(already.map((e) => e.date.toISOString().slice(0, 10)));
  const newKeys = dateKeys.filter((k) => !alreadyKeys.has(k));

  if (newKeys.length === 0) {
    return { ok: false, error: "選択された日付はすべて申請済みです" };
  }

  const app = await getOrCreateDraft(user.id, monthKey);

  await prisma.commuteEntry.createMany({
    data: newKeys.map((k) => ({
      applicationId: app.id,
      routeId: route.id,
      date: dateKeyToDate(k),
      amount,
      routeNameSnapshot: route.name,
    })),
    skipDuplicates: true,
  });

  const skipped = dateKeys.length - newKeys.length;
  revalidateExpenses();
  return {
    ok: true,
    message:
      `${newKeys.length}日分（${(amount * newKeys.length).toLocaleString("ja-JP")}円）を追加しました` +
      (skipped > 0 ? `（申請済みの${skipped}日は除外）` : ""),
  };
}

/* ------------------------------------------------------------------ */
/* 小物（自由入力）                                                     */
/* ------------------------------------------------------------------ */

export async function submitFreeItemAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const monthKey = String(formData.get("monthKey") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const receipt = formData.get("receipt");

  if (!monthKeyRe.test(monthKey)) return { ok: false, error: "対象月が不正です" };
  if (!name) return { ok: false, error: "品物名を入力してください" };
  if (name.length > 120) return { ok: false, error: "品物名が長すぎます" };
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "金額は1以上の整数で入力してください" };
  }
  if (amount > 10_000_000) return { ok: false, error: "金額が大きすぎます" };

  let receiptKey: string | null = null;
  let receiptMimeType: string | null = null;

  if (receipt instanceof File && receipt.size > 0) {
    if (receipt.size > MAX_RECEIPT_BYTES) {
      return { ok: false, error: "領収書のサイズが大きすぎます（上限 8MB）" };
    }
    const bytes = Buffer.from(await receipt.arrayBuffer());
    // iPhone は HEIC の MIME タイプを空で送ることがあるため、中身でも判定する
    if (!isSupportedReceipt(bytes, receipt.type)) {
      return {
        ok: false,
        error: "領収書は JPEG・PNG・WebP・HEIC 形式のみ添付できます",
      };
    }
    try {
      // HEIC は保存時に JPEG へ変換されるため、実際の形式は戻り値から取る
      const saved = await putReceipt(user.id, bytes, receipt.type);
      receiptKey = saved.key;
      receiptMimeType = saved.contentType;
    } catch (e) {
      return { ok: false, error: storageErrorMessage(e) };
    }
  }

  const app = await getOrCreateDraft(user.id, monthKey);

  await prisma.freeItemEntry.create({
    data: { applicationId: app.id, name, amount, receiptKey, receiptMimeType },
  });

  revalidateExpenses();
  return { ok: true, message: `「${name}」を追加しました` };
}

export async function updateFreeItemAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const receipt = formData.get("receipt");

  if (!id) return { ok: false, error: "対象が指定されていません" };
  if (!name) return { ok: false, error: "品物名を入力してください" };
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "金額は1以上の整数で入力してください" };
  }

  const entry = await prisma.freeItemEntry.findFirst({
    where: { id, application: { userId: user.id } },
    include: { application: true },
  });
  if (!entry) return { ok: false, error: "品目が見つかりません" };
  if (entry.application.status === "submitted") {
    return { ok: false, error: "提出済みの申請は編集できません" };
  }

  const data: Prisma.FreeItemEntryUpdateInput = { name, amount };

  if (receipt instanceof File && receipt.size > 0) {
    if (receipt.size > MAX_RECEIPT_BYTES) {
      return { ok: false, error: "領収書のサイズが大きすぎます（上限 8MB）" };
    }
    const bytes = Buffer.from(await receipt.arrayBuffer());
    // iPhone は HEIC の MIME タイプを空で送ることがあるため、中身でも判定する
    if (!isSupportedReceipt(bytes, receipt.type)) {
      return {
        ok: false,
        error: "領収書は JPEG・PNG・WebP・HEIC 形式のみ添付できます",
      };
    }
    try {
      const saved = await putReceipt(user.id, bytes, receipt.type);
      data.receiptKey = saved.key;
      data.receiptMimeType = saved.contentType;
    } catch (e) {
      return { ok: false, error: storageErrorMessage(e) };
    }
    if (entry.receiptKey) await deleteReceipt(entry.receiptKey);
  }

  await prisma.freeItemEntry.update({ where: { id }, data });
  revalidateExpenses();
  return { ok: true, message: "品目を更新しました" };
}

/* ------------------------------------------------------------------ */
/* 小物（カテゴリ一覧）                                                 */
/* ------------------------------------------------------------------ */

const categorySubmitSchema = z.object({
  monthKey: z.string().regex(monthKeyRe, "対象月が不正です"),
  items: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        quantity: z.number().int().min(1).max(9999),
      }),
    )
    .min(1, "数量を1以上にした品目がありません"),
});

export async function submitCategoryItemsAction(
  input: z.input<typeof categorySubmitSchema>,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = categorySubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }
  const { monthKey, items } = parsed.data;

  const categories = await prisma.itemCategory.findMany({
    where: { id: { in: items.map((i) => i.categoryId) }, isActive: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));
  if (byId.size !== items.length) {
    return { ok: false, error: "選択されたカテゴリの一部が無効です" };
  }

  const app = await getOrCreateDraft(user.id, monthKey);

  // カテゴリが後から変更・削除されても明細が変わらないよう値を複製して保存する
  await prisma.itemEntry.createMany({
    data: items.map((i) => {
      const c = byId.get(i.categoryId)!;
      return {
        applicationId: app.id,
        categoryId: c.id,
        nameSnapshot: c.name,
        unitCostSnapshot: c.unitCost,
        unitSnapshot: c.unit,
        quantity: i.quantity,
        amount: c.unitCost * i.quantity,
      };
    }),
  });

  const total = items.reduce(
    (sum, i) => sum + byId.get(i.categoryId)!.unitCost * i.quantity,
    0,
  );

  revalidateExpenses();
  return {
    ok: true,
    message: `${items.length}品目（${total.toLocaleString("ja-JP")}円）を追加しました`,
  };
}

/* ------------------------------------------------------------------ */
/* 提出                                                                 */
/* ------------------------------------------------------------------ */

export async function submitApplicationAction(
  monthKey: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!monthKeyRe.test(monthKey)) return { ok: false, error: "対象月が不正です" };

  const app = await prisma.expenseApplication.findFirst({
    where: {
      userId: user.id,
      targetMonth: monthKeyToDate(monthKey),
      status: "draft",
    },
    include: {
      _count: {
        select: { commuteEntries: true, itemEntries: true, freeItemEntries: true },
      },
    },
  });

  if (!app) return { ok: false, error: "提出できる申請がありません" };

  const count =
    app._count.commuteEntries +
    app._count.itemEntries +
    app._count.freeItemEntries;
  if (count === 0) {
    return { ok: false, error: "申請内容がありません。項目を追加してください" };
  }

  await prisma.expenseApplication.update({
    where: { id: app.id },
    data: { status: "submitted", submittedAt: new Date() },
  });

  revalidateExpenses();
  return { ok: true, message: "申請を提出しました" };
}

/* ------------------------------------------------------------------ */
/* 削除                                                                 */
/* ------------------------------------------------------------------ */

type EntryKind = "commute" | "item" | "freeItem";

/** 個別エントリの削除（自分の申請のみ） */
export async function deleteEntryAction(
  kind: EntryKind,
  entryId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const scope = { application: { userId: user.id } };

  if (kind === "commute") {
    const r = await prisma.commuteEntry.deleteMany({ where: { id: entryId, ...scope } });
    if (r.count === 0) return { ok: false, error: "エントリが見つかりません" };
  } else if (kind === "item") {
    const r = await prisma.itemEntry.deleteMany({ where: { id: entryId, ...scope } });
    if (r.count === 0) return { ok: false, error: "エントリが見つかりません" };
  } else {
    const entry = await prisma.freeItemEntry.findFirst({
      where: { id: entryId, ...scope },
    });
    if (!entry) return { ok: false, error: "エントリが見つかりません" };
    await prisma.freeItemEntry.delete({ where: { id: entryId } });
    if (entry.receiptKey) await deleteReceipt(entry.receiptKey);
  }

  revalidateExpenses();
  return { ok: true, message: "削除しました" };
}

/** 申請全体の削除（自分の申請のみ。管理者による他社員分の削除は管理画面で扱う） */
export async function deleteApplicationAction(
  applicationId: string,
): Promise<ActionResult> {
  const user = await requireUser();

  const app = await prisma.expenseApplication.findFirst({
    where: { id: applicationId, userId: user.id },
    include: { freeItemEntries: { select: { receiptKey: true } } },
  });
  if (!app) return { ok: false, error: "申請が見つかりません" };

  await prisma.expenseApplication.delete({ where: { id: applicationId } });

  // 明細は cascade で消えるため、残る領収書ファイルだけ後始末する
  for (const e of app.freeItemEntries) {
    if (e.receiptKey) await deleteReceipt(e.receiptKey);
  }

  revalidateExpenses();
  return { ok: true, message: "申請を削除しました" };
}
