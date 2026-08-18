/**
 * 通勤費の計算ロジック
 * 仕様書「通勤費タブ」より
 */

/**
 * 国税庁の通勤手当 非課税限度額（片道距離に応じた月額上限）
 * 仕様書の表をそのまま実装。
 */
const NON_TAXABLE_TABLE: { minKm: number; monthlyLimit: number }[] = [
  { minKm: 55, monthlyLimit: 38_700 },
  { minKm: 45, monthlyLimit: 32_300 },
  { minKm: 35, monthlyLimit: 25_900 },
  { minKm: 25, monthlyLimit: 19_700 },
  { minKm: 15, monthlyLimit: 13_500 },
  { minKm: 10, monthlyLimit: 7_300 },
  { minKm: 2, monthlyLimit: 4_200 },
  { minKm: 0, monthlyLimit: 0 },
];

/** 片道距離(km)に対応する月額非課税限度額（円） */
export function nonTaxableMonthlyLimit(distanceKm: number): number {
  const row = NON_TAXABLE_TABLE.find((r) => distanceKm >= r.minKm);
  return row ? row.monthlyLimit : 0;
}

/** 非課税限度額の表示用ラベル（例: 「10km以上15km未満」） */
export function nonTaxableBracketLabel(distanceKm: number): string {
  if (distanceKm < 2) return "2km未満";
  if (distanceKm < 10) return "2km以上10km未満";
  if (distanceKm < 15) return "10km以上15km未満";
  if (distanceKm < 25) return "15km以上25km未満";
  if (distanceKm < 35) return "25km以上35km未満";
  if (distanceKm < 45) return "35km以上45km未満";
  if (distanceKm < 55) return "45km以上55km未満";
  return "55km以上";
}

/** 車通勤の 1 日あたり交通費 = 片道距離 × 2(往復) × 単価(円/km) */
export function carDailyFare(distanceKm: number, ratePerKm: number): number {
  return Math.round(distanceKm * 2 * ratePerKm);
}

export const RATE_PER_KM_KEY = "commute_rate_per_km";
export const RATE_PER_KM_DEFAULT = 15;
export const RATE_PER_KM_MIN = 1;
export const RATE_PER_KM_MAX = 1000;

/** 経路 1 件から 1 日あたり金額を算出する */
export function routeDailyFare(
  route: {
    transportType: "public_transit" | "car";
    dailyFare: number | null;
    distanceKm: number | null;
  },
  ratePerKm: number,
): number {
  if (route.transportType === "public_transit") return route.dailyFare ?? 0;
  return carDailyFare(route.distanceKm ?? 0, ratePerKm);
}
