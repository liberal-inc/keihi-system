import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma CLI（generate / migrate / db seed）用の設定。
// アプリ実行時のクライアントは src/lib/prisma.ts でドライバアダプタを組み立てる。
//
// `prisma generate` は DB に接続しないため DATABASE_URL を必要としない。
// ビルド時（環境変数がまだ無い状態）でも失敗しないよう、値がある場合だけ
// datasource を渡す。migrate / seed は実行時に必ず設定されている。
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
