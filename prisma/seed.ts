import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

/**
 * 初期データ。
 * ログインは loginName（お名前）の入力のみで行う。
 * 社員の追加・変更は管理画面「社員管理」からも実行できる。
 */
const USERS = [
  {
    loginName: "志村",
    name: "志村",
    employeeNo: "0001",
    role: "owner" as const,
    department: "経営管理部",
  },
  {
    loginName: "齋藤",
    name: "齋藤",
    employeeNo: "0002",
    role: "user" as const,
    department: "営業部",
  },
];

const CATEGORIES = [
  { name: "ボールペン", unitCost: 150, unit: "本" },
  { name: "コピー用紙 (A4 500枚)", unitCost: 480, unit: "冊" },
  { name: "クリアファイル", unitCost: 90, unit: "枚" },
  { name: "名刺用紙", unitCost: 780, unit: "箱" },
  { name: "電池 (単三 4本入)", unitCost: 420, unit: "パック" },
  { name: "付箋", unitCost: 220, unit: "個" },
];

async function main() {
  console.log("シードを投入します…");

  // 部署
  const departmentNames = [...new Set(USERS.map((u) => u.department))];
  const departments = new Map<string, string>();
  for (const name of departmentNames) {
    const d = await prisma.department.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    departments.set(name, d.id);
  }

  // ユーザー（loginName を一意キーとして upsert）
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { loginName: u.loginName },
      create: {
        loginName: u.loginName,
        name: u.name,
        employeeNo: u.employeeNo,
        role: u.role,
        departmentId: departments.get(u.department),
      },
      update: {
        name: u.name,
        role: u.role,
        departmentId: departments.get(u.department),
      },
    });
  }

  // 小物カテゴリ
  for (const c of CATEGORIES) {
    const existing = await prisma.itemCategory.findFirst({
      where: { name: c.name },
    });
    if (existing) {
      await prisma.itemCategory.update({ where: { id: existing.id }, data: c });
    } else {
      await prisma.itemCategory.create({ data: c });
    }
  }

  // システム設定: 車通勤の 1km あたり単価
  await prisma.systemSetting.upsert({
    where: { key: "commute_rate_per_km" },
    create: { key: "commute_rate_per_km", value: "15" },
    update: {},
  });

  console.log("完了しました。");
  console.log("");
  console.log("  ログイン時に入力するお名前");
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(6)} ${u.loginName}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
