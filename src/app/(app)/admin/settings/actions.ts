"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { RATE_PER_KM_MAX, RATE_PER_KM_MIN } from "@/lib/commute";
import { setRatePerKm } from "@/lib/settings";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** 車通勤の 1km あたり単価を更新する（仕様: 1〜1000 円/km） */
export async function updateRatePerKmAction(
  value: number,
): Promise<ActionResult> {
  await requireRole("admin", "owner");

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, error: "単価は整数で入力してください" };
  }
  if (value < RATE_PER_KM_MIN || value > RATE_PER_KM_MAX) {
    return {
      ok: false,
      error: `単価は ${RATE_PER_KM_MIN}〜${RATE_PER_KM_MAX} 円/km の範囲で入力してください`,
    };
  }

  await setRatePerKm(value);

  // 経費申請の金額表示に影響するため、関連ページを作り直す
  revalidatePath("/admin/settings");
  revalidatePath("/expenses/new");
  revalidatePath("/admin/routes");

  return { ok: true, message: `単価を ${value} 円/km に更新しました` };
}
