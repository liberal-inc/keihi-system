import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { findAccessibleApplication } from "@/lib/expense-access";
import { toPdfApplication } from "@/lib/pdf/collect";
import { buildExpensePdf, pdfFileName } from "@/lib/pdf/expense-pdf";

// pdfkit はフォントファイルを読むため Node.js ランタイムで動かす
export const runtime = "nodejs";

/** 申請 1 件の PDF ダウンロード */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { applicationId } = await params;

  const app = await findAccessibleApplication(user, applicationId);
  if (!app) return new NextResponse("Not Found", { status: 404 });

  const pdf = await buildExpensePdf(await toPdfApplication(app));

  const fileName = pdfFileName({
    userName: app.user.name,
    targetMonth: app.targetMonth,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // 日本語ファイル名は RFC 5987 形式で渡す
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
