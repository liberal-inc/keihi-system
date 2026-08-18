import "server-only";

import { prisma } from "@/lib/prisma";
import {
  RATE_PER_KM_DEFAULT,
  RATE_PER_KM_KEY,
  RATE_PER_KM_MAX,
  RATE_PER_KM_MIN,
} from "@/lib/commute";

/** 車通勤の 1km あたり単価（円）。未設定ならデフォルト値。 */
export async function getRatePerKm(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: RATE_PER_KM_KEY },
  });
  const value = Number(row?.value);
  if (!Number.isFinite(value)) return RATE_PER_KM_DEFAULT;
  return Math.min(RATE_PER_KM_MAX, Math.max(RATE_PER_KM_MIN, Math.round(value)));
}

export async function setRatePerKm(value: number): Promise<void> {
  const clamped = Math.min(
    RATE_PER_KM_MAX,
    Math.max(RATE_PER_KM_MIN, Math.round(value)),
  );
  await prisma.systemSetting.upsert({
    where: { key: RATE_PER_KM_KEY },
    create: { key: RATE_PER_KM_KEY, value: String(clamped) },
    update: { value: String(clamped) },
  });
}
