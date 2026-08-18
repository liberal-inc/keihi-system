import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma CLI（migrate / db seed）用の設定。
// アプリ実行時のクライアントは src/lib/prisma.ts でドライバアダプタを組み立てる。
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
