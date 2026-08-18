/**
 * 開発用: DB の申請から PDF を生成してファイルに書き出す。
 *   npx tsx scripts/pdf-preview.ts [出力先]
 */
import "dotenv/config";

import { writeFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma";
import { buildBulkExpensePdf } from "../src/lib/pdf/expense-pdf";
import { getReceipt } from "../src/lib/storage";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

async function main() {
  const out = process.argv[2] ?? "/tmp/expense-preview.pdf";

  const apps = await prisma.expenseApplication.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          name: true,
          employeeNo: true,
          department: { select: { name: true } },
        },
      },
      commuteEntries: { orderBy: { date: "asc" } },
      itemEntries: { orderBy: { createdAt: "asc" } },
      freeItemEntries: { orderBy: { createdAt: "asc" } },
    },
  });

  const pdfApps = await Promise.all(
    apps.map(async (a) => ({
      id: a.id,
      userName: a.user.name,
      employeeNo: a.user.employeeNo,
      departmentName: a.user.department?.name ?? null,
      targetMonth: a.targetMonth,
      status: a.status,
      submittedAt: a.submittedAt,
      commuteEntries: a.commuteEntries,
      itemEntries: a.itemEntries,
      freeItemEntries: await Promise.all(
        a.freeItemEntries.map(async (e) => ({
          name: e.name,
          amount: e.amount,
          receipt: e.receiptKey ? await getReceipt(e.receiptKey) : null,
        })),
      ),
    })),
  );

  writeFileSync(out, await buildBulkExpensePdf(pdfApps));
  console.log(`${apps.length} 件の申請を ${out} に出力しました`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
