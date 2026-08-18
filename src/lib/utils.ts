import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 1,234 円 の形式 */
export function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")} 円`;
}

/** YYYY-MM-DD（ローカルタイム基準） */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM */
export function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" -> その月の 1 日 (UTC 正午基準で保存し、TZ ずれを避ける) */
export function monthKeyToDate(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
}

/** "YYYY-MM-DD" -> Date (UTC 0時) */
export function dateKeyToDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

/** DB の DateTime(UTC 0時保存) -> "YYYY-MM-DD" */
export function dbDateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 2026-08-17 -> 2026年8月17日 */
export function formatJpDate(d: Date | string): string {
  const key = typeof d === "string" ? d : dbDateToKey(d);
  const [y, m, day] = key.split("-").map(Number);
  return `${y}年${m}月${day}日`;
}

/** 2026-08 -> 2026年8月 */
export function formatJpMonth(d: Date | string): string {
  const key = typeof d === "string" ? d.slice(0, 7) : dbDateToKey(d).slice(0, 7);
  const [y, m] = key.split("-").map(Number);
  return `${y}年${m}月`;
}

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

export function weekdayJp(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return WEEKDAY_JP[new Date(y, m - 1, d).getDay()];
}
