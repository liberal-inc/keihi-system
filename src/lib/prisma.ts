import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * 接続先に応じて TLS を有効にする。
 * TiDB Cloud / PlanetScale などのマネージド MySQL は TLS 必須なので、
 * 接続文字列に sslaccept=strict / ssl=true が付いていれば有効化する。
 * Railway の MySQL のように内部ネットワークで完結する場合は不要。
 */
function buildAdapter(rawUrl: string) {
  const url = new URL(rawUrl);
  const sslParam =
    url.searchParams.get("sslaccept") ?? url.searchParams.get("ssl");
  const useTls = sslParam === "strict" || sslParam === "true";

  // ドライバが解釈できないクエリは取り除いてから渡す
  url.searchParams.delete("sslaccept");
  url.searchParams.delete("ssl");

  if (!useTls) return new PrismaMariaDb(url.toString());

  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: true },
    connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT ?? 5),
  });
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

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
