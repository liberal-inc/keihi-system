/**
 * アプリ起動時に動く処理（Next.js の instrumentation フック）。
 * Node.js ランタイムのときだけ DB の生存監視を読み込む。
 * （監視側は process.exit を使うため、Edge 向けのバンドルに含めない）
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startDbWatchdog } = await import("@/lib/db-watchdog");
  await startDbWatchdog();
}
