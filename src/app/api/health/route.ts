import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 稼働確認用。DB まで到達できるかを見る。
 * 利用者が「開けない」と言う前に、ここで切り分けられるようにするためのもの。
 * 認証情報は一切返さない。
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", database: "ok", ms: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("ヘルスチェックに失敗しました", e);
    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        ms: Date.now() - startedAt,
        // 詳細は返さない（接続文字列などが混ざりうるため）
        hint: "データベースに接続できません。Railway の MySQL の状態を確認してください。",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
