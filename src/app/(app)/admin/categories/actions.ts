"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "品目名を入力してください").max(80),
  unitCost: z
    .number()
    .int("単価は整数で入力してください")
    .min(1, "単価は1円以上で入力してください")
    .max(10_000_000, "単価が大きすぎます"),
  unit: z.string().trim().min(1, "単位を入力してください").max(10),
  isActive: z.boolean(),
});

export type CategoryInput = z.input<typeof categorySchema>;

function revalidateCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/expenses/new");
}

export async function saveCategoryAction(
  input: CategoryInput,
): Promise<ActionResult> {
  await requireRole("admin", "owner");

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
    };
  }
  const d = parsed.data;

  // 同名のカテゴリが二重にできないようにする
  const duplicate = await prisma.itemCategory.findFirst({
    where: { name: d.name, ...(d.id ? { NOT: { id: d.id } } : {}) },
  });
  if (duplicate) {
    return { ok: false, error: `「${d.name}」はすでに登録されています` };
  }

  const data = {
    name: d.name,
    unitCost: d.unitCost,
    unit: d.unit,
    isActive: d.isActive,
  };

  if (d.id) {
    const updated = await prisma.itemCategory.updateMany({
      where: { id: d.id },
      data,
    });
    if (updated.count === 0) {
      return { ok: false, error: "カテゴリが見つかりません" };
    }
    revalidateCategories();
    return { ok: true, message: `「${d.name}」を更新しました` };
  }

  await prisma.itemCategory.create({ data });
  revalidateCategories();
  return { ok: true, message: `「${d.name}」を追加しました` };
}

/** 有効/無効の切り替え（無効にすると申請画面の選択肢から外れる） */
export async function toggleCategoryAction(
  categoryId: string,
): Promise<ActionResult> {
  await requireRole("admin", "owner");

  const category = await prisma.itemCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) return { ok: false, error: "カテゴリが見つかりません" };

  await prisma.itemCategory.update({
    where: { id: categoryId },
    data: { isActive: !category.isActive },
  });

  revalidateCategories();
  return {
    ok: true,
    message: `「${category.name}」を${category.isActive ? "無効" : "有効"}にしました`,
  };
}

export async function deleteCategoryAction(
  categoryId: string,
): Promise<ActionResult> {
  await requireRole("admin", "owner");

  const category = await prisma.itemCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { entries: true } } },
  });
  if (!category) return { ok: false, error: "カテゴリが見つかりません" };

  // 申請明細は名前・単価を複製して保持しているため、削除しても過去の金額は変わらない
  await prisma.itemCategory.delete({ where: { id: categoryId } });

  revalidateCategories();
  return {
    ok: true,
    message:
      `「${category.name}」を削除しました` +
      (category._count.entries > 0
        ? `（過去の申請明細 ${category._count.entries} 件はそのまま残ります）`
        : ""),
  };
}
