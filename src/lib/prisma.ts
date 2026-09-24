import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * 接続文字列からコネクションプールの設定を組み立てる。
 *
 * ここで明示的に設定しているのは、DB が再起動したときに
 * アプリが切れた接続を掴んだまま復旧しなくなるのを防ぐため。
 * （Railway は MySQL のイメージを自動更新することがあり、そのたびに
 *   DB 側が再起動して既存の接続がすべて切れる）
 *
 * TiDB Cloud のようなマネージド MySQL は TLS 必須なので、
 * 接続文字列に sslaccept=strict / ssl=true が付いていれば有効化する。
 */
function buildAdapter(rawUrl: string) {
  const url = new URL(rawUrl);

  const sslParam =
    url.searchParams.get("sslaccept") ?? url.searchParams.get("ssl");
  const useTls = sslParam === "strict" || sslParam === "true";

  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ...(useTls ? { ssl: { rejectUnauthorized: true } } : {}),

    connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT ?? 5),

    // 使い回す前に、一定時間アイドルだった接続は疎通確認してから渡す。
    // これが無いと、DB 再起動で死んだ接続をそのまま使おうとして失敗し続ける。
    minDelayValidation: 500,

    // 長くアイドルな接続は破棄して作り直す（既定は 1800 秒と長い）
    idleTimeout: 60,

    // 応答が無いときに無限に待たない
    connectTimeout: 10_000,
    acquireTimeout: 10_000,
    initializationTimeout: 10_000,
  });
}

/** プールが枯れている等、作り直せば直る可能性が高いエラーか */
function isRecoverableConnectionError(e: unknown): boolean {
  const message =
    e instanceof Error ? `${e.message}` : typeof e === "string" ? e : "";
  return (
    message.includes("pool timeout") ||
    message.includes("Can't add new command when connection is in closed state") ||
    message.includes("Connection closed") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ENOTFOUND")
  );
}

/**
 * クライアントは初回アクセス時に作る。
 * ビルド時（DATABASE_URL がまだ無い状態）に import されても落ちないようにするため、
 * モジュール読み込み時点では接続を組み立てない。
 */
function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が設定されていません");

  const client = new PrismaClient({ adapter: buildAdapter(url) });
  globalForPrisma.prisma = client;
  return client;
}

/** 壊れたプールを捨てて、次回アクセス時に作り直させる */
function resetClient() {
  const stale = globalForPrisma.prisma;
  globalForPrisma.prisma = undefined;
  // 切断は待たない（失敗しても新しいプールの作成を妨げないため）
  stale?.$disconnect().catch(() => undefined);
}

/**
 * 接続系のエラーで落ちた場合、プールを作り直して 1 度だけやり直す。
 * DB 再起動後に「誰かが手動で再起動するまで直らない」状態を避けるため。
 */
function withRecovery<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((e) => {
    if (!isRecoverableConnectionError(e)) throw e;
    console.error("DB 接続に失敗したため、接続プールを作り直します", e);
    resetClient();
    return run();
  });
}

/** Prisma のモデル操作（findMany など）を包んで、失敗時に作り直せるようにする */
function wrapDelegate(delegateName: string): unknown {
  return new Proxy(
    {},
    {
      get(_t, method) {
        return (...args: unknown[]) =>
          withRecovery(() => {
            const client = getClient() as unknown as Record<
              string,
              Record<string, (...a: unknown[]) => Promise<unknown>>
            >;
            return client[delegateName][method as string](...args);
          });
      },
    },
  );
}

/** モデル以外（$transaction など）はそのまま呼ぶ */
const PASSTHROUGH = new Set([
  "$connect",
  "$disconnect",
  "$on",
  "$extends",
  "then",
  "catch",
  "finally",
]);

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const name = String(prop);

    if (typeof prop === "symbol" || PASSTHROUGH.has(name)) {
      const client = getClient();
      const value = Reflect.get(client, prop, client);
      return typeof value === "function" ? value.bind(client) : value;
    }

    // $queryRaw / $executeRaw / $transaction などのトップレベル関数
    if (name.startsWith("$")) {
      return (...args: unknown[]) =>
        withRecovery(() => {
          const client = getClient() as unknown as Record<
            string,
            (...a: unknown[]) => Promise<unknown>
          >;
          return client[name](...args);
        });
    }

    return wrapDelegate(name);
  },
});
