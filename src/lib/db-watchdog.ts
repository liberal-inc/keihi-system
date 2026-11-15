import "server-only";

/**
 * DB の生存監視。
 *
 * 背景: Railway は MySQL のイメージを自動更新することがあり、そのたびに
 * DB のコンテナが入れ替わる。するとアプリ側は古い接続先を掴んだままになり、
 * 接続プールを作り直しても同じ古い宛先へ繋ごうとして復旧しない
 * （2026-09-19・2026-11-14 に発生。いずれも手動での再起動が必要だった）。
 *
 * プロセスを作り直せば新しい宛先に繋がるため、
 * 「一度は繋がっていたのに繋がらなくなった」場合に限り自分で終了し、
 * Railway の再起動ポリシー（ON_FAILURE）に任せて復帰する。
 */

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const CHECK_INTERVAL_MS = num(process.env.DB_WATCHDOG_INTERVAL_MS, 60_000);
/** 連続でこの回数失敗したら再起動する（既定: 約5分） */
const FAILURE_THRESHOLD = num(process.env.DB_WATCHDOG_THRESHOLD, 5);
/** 起動直後は DB の準備待ちがあるので少し置いてから監視を始める */
const START_DELAY_MS = num(process.env.DB_WATCHDOG_START_DELAY_MS, 90_000);

export async function startDbWatchdog(): Promise<void> {
  if (process.env.DB_WATCHDOG === "off") return;
  if (process.env.NODE_ENV !== "production" && process.env.DB_WATCHDOG !== "on") {
    return;
  }

  const { prisma } = await import("@/lib/prisma");

  // 一度も繋がっていないうちは再起動しても意味がないため、
  // 「繋がった実績がある」ことを再起動の条件にする。
  // （DB 自体が落ちている場合に再起動を繰り返さないための歯止め）
  let hasBeenHealthy = false;
  let consecutiveFailures = 0;

  const tick = async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      if (consecutiveFailures > 0) {
        console.log(
          `[db-watchdog] DB への接続が回復しました（${consecutiveFailures} 回連続の失敗後）`,
        );
      }
      hasBeenHealthy = true;
      consecutiveFailures = 0;
    } catch (e) {
      consecutiveFailures += 1;
      console.error(
        `[db-watchdog] DB に接続できません（${consecutiveFailures}/${FAILURE_THRESHOLD} 回目）:`,
        e instanceof Error ? e.message.split("\n")[0] : e,
      );

      // 起動以来一度も繋がっていない場合は、再起動しても状況が変わらないので待つ
      if (!hasBeenHealthy) return;

      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        console.error(
          "[db-watchdog] 復旧しないため、プロセスを終了して再起動します" +
            "（DB のコンテナが入れ替わった可能性があります）",
        );
        process.exit(1);
      }
    }
  };

  setTimeout(() => {
    void tick();
    const timer = setInterval(() => void tick(), CHECK_INTERVAL_MS);
    timer.unref?.();
  }, START_DELAY_MS).unref?.();

  console.log(
    `[db-watchdog] DB の生存監視を開始しました（${CHECK_INTERVAL_MS / 1000}秒ごと / ${FAILURE_THRESHOLD}回連続失敗で再起動）`,
  );
}
