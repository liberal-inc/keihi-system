import { NextResponse } from "next/server";

import { getSessionUser, isAdminLike } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReceipt } from "@/lib/storage";

/** 領収書画像の配信。自分の申請、または管理者・オーナーのみ閲覧できる。 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { entryId } = await params;

  const entry = await prisma.freeItemEntry.findUnique({
    where: { id: entryId },
    include: { application: { select: { userId: true } } },
  });

  if (!entry?.receiptKey) return new NextResponse("Not Found", { status: 404 });

  const isOwnerOfEntry = entry.application.userId === user.id;
  if (!isOwnerOfEntry && !isAdminLike(user.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const file = await getReceipt(entry.receiptKey);
  if (!file) return new NextResponse("Not Found", { status: 404 });

  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
