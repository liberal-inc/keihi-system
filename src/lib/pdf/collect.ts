import "server-only";

import { getReceipt } from "@/lib/storage";
import type { AccessibleApplication } from "@/lib/expense-access";
import type { PdfApplication } from "./expense-pdf";

/** DB のレコードを PDF 生成用の形に変換する（領収書画像もここで読み込む） */
export async function toPdfApplication(
  app: AccessibleApplication,
): Promise<PdfApplication> {
  const freeItemEntries = await Promise.all(
    app.freeItemEntries.map(async (e) => ({
      name: e.name,
      amount: e.amount,
      receipt: e.receiptKey ? await getReceipt(e.receiptKey) : null,
    })),
  );

  return {
    id: app.id,
    userName: app.user.name,
    employeeNo: app.user.employeeNo,
    departmentName: app.user.department?.name ?? null,
    targetMonth: app.targetMonth,
    status: app.status,
    submittedAt: app.submittedAt,
    commuteEntries: app.commuteEntries.map((e) => ({
      date: e.date,
      routeNameSnapshot: e.routeNameSnapshot,
      amount: e.amount,
    })),
    itemEntries: app.itemEntries.map((e) => ({
      nameSnapshot: e.nameSnapshot,
      quantity: e.quantity,
      unitSnapshot: e.unitSnapshot,
      amount: e.amount,
    })),
    freeItemEntries,
  };
}
