import { NextResponse } from "next/server";

import { getSessionUser, isAdminLike } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expenseScopeWhere } from "@/lib/expense-access";
import { toPdfApplication } from "@/lib/pdf/collect";
import { buildBulkExpensePdf } from "@/lib/pdf/expense-pdf";
import { monthKeyToDate } from "@/lib/utils";

export const runtime = "nodejs";

/** 一度に束ねる申請の上限（生成時間とメモリを抑えるため） */
const MAX_APPLICATIONS = 200;

/** 指定月の申請をまとめて 1 つの PDF にする（管理者・オーナー） */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!isAdminLike(user.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const monthKey = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return new NextResponse("month パラメータが不正です", { status: 400 });
  }

  const applications = await prisma.expenseApplication.findMany({
    where: {
      AND: [{ targetMonth: monthKeyToDate(monthKey) }, expenseScopeWhere(user)],
    },
    orderBy: [{ user: { employeeNo: "asc" } }, { createdAt: "asc" }],
    take: MAX_APPLICATIONS,
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

  const pdfApps = await Promise.all(applications.map(toPdfApplication));
  const pdf = await buildBulkExpensePdf(pdfApps);

  const fileName = `経費申請一覧_${monthKey}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
