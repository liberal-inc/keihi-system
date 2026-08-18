"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canCommentOnReports, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { richTextToPlain, sanitizeRichText } from "@/lib/sanitize";
import { dateKeyToDate } from "@/lib/utils";

export type ActionResult =
  | { ok: true; message: string; reportId?: string }
  | { ok: false; error: string };

const reportSchema = z.object({
  id: z.string().optional(),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "対象日が不正です"),
  content: z.string().min(1, "業務内容を入力してください"),
  reflection: z.string().optional(),
  nextPlan: z.string().optional(),
  status: z.enum(["draft", "submitted"]),
});

function revalidateReports() {
  revalidatePath("/reports");
  revalidatePath("/reports/new");
  revalidatePath("/dashboard");
}

/** 日報の作成・更新（下書き保存 / 提出） */
export async function saveReportAction(
  input: z.input<typeof reportSchema>,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }
  const d = parsed.data;

  const content = sanitizeRichText(d.content);
  if (richTextToPlain(content).length === 0) {
    return { ok: false, error: "業務内容を入力してください" };
  }

  const reflection = d.reflection ? sanitizeRichText(d.reflection) : null;
  const nextPlan = d.nextPlan ? sanitizeRichText(d.nextPlan) : null;

  const data = {
    content,
    reflection: reflection && richTextToPlain(reflection) ? reflection : null,
    nextPlan: nextPlan && richTextToPlain(nextPlan) ? nextPlan : null,
    status: d.status,
    submittedAt: d.status === "submitted" ? new Date() : null,
  };

  const message =
    d.status === "submitted" ? "日報を提出しました" : "下書きを保存しました";

  if (d.id) {
    const existing = await prisma.dailyReport.findFirst({
      where: { id: d.id, userId: user.id },
    });
    if (!existing) return { ok: false, error: "日報が見つかりません" };

    // 提出済みの日報は再編集させない（コメントが付いた後の書き換えを防ぐ）
    if (existing.status === "submitted") {
      return { ok: false, error: "提出済みの日報は編集できません" };
    }

    await prisma.dailyReport.update({
      where: { id: d.id },
      // 提出済みは submittedAt を保持したいので、既存値を尊重する
      data: {
        ...data,
        submittedAt:
          d.status === "submitted" ? (existing.submittedAt ?? new Date()) : null,
      },
    });
    revalidateReports();
    return { ok: true, message, reportId: d.id };
  }

  // 同じ日の日報が既にある場合はそちらへ誘導する（1日1件）
  const duplicate = await prisma.dailyReport.findUnique({
    where: {
      userId_reportDate: {
        userId: user.id,
        reportDate: dateKeyToDate(d.reportDate),
      },
    },
  });
  if (duplicate) {
    return {
      ok: false,
      error: "この日付の日報はすでに作成されています。日報一覧から編集してください",
    };
  }

  const created = await prisma.dailyReport.create({
    data: {
      ...data,
      userId: user.id,
      reportDate: dateKeyToDate(d.reportDate),
    },
  });

  revalidateReports();
  return { ok: true, message, reportId: created.id };
}

/** 下書きの日報を提出する */
export async function submitReportAction(
  reportId: string,
): Promise<ActionResult> {
  const user = await requireUser();

  const report = await prisma.dailyReport.findFirst({
    where: { id: reportId, userId: user.id },
  });
  if (!report) return { ok: false, error: "日報が見つかりません" };
  if (report.status === "submitted") {
    return { ok: false, error: "すでに提出済みです" };
  }

  await prisma.dailyReport.update({
    where: { id: reportId },
    data: { status: "submitted", submittedAt: new Date() },
  });

  revalidateReports();
  return { ok: true, message: "日報を提出しました" };
}

export async function deleteReportAction(
  reportId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const deleted = await prisma.dailyReport.deleteMany({
    where: { id: reportId, userId: user.id },
  });
  if (deleted.count === 0) return { ok: false, error: "日報が見つかりません" };

  revalidateReports();
  return { ok: true, message: "日報を削除しました" };
}

/* ------------------------------------------------------------------ */
/* コメント（マネージャー・管理者・オーナー）                            */
/* ------------------------------------------------------------------ */

export async function addCommentAction(
  reportId: string,
  body: string,
): Promise<ActionResult> {
  const user = await requireUser();

  if (!canCommentOnReports(user.role)) {
    return { ok: false, error: "コメントする権限がありません" };
  }

  const text = body.trim();
  if (!text) return { ok: false, error: "コメントを入力してください" };
  if (text.length > 2000) return { ok: false, error: "コメントが長すぎます" };

  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: { user: { select: { departmentId: true } } },
  });
  if (!report) return { ok: false, error: "日報が見つかりません" };
  if (report.status !== "submitted") {
    return { ok: false, error: "提出済みの日報にのみコメントできます" };
  }

  // マネージャーは担当部署の社員の日報にのみコメントできる
  if (
    user.role === "manager" &&
    (!user.managedDepartmentId ||
      report.user.departmentId !== user.managedDepartmentId)
  ) {
    return { ok: false, error: "この日報にコメントする権限がありません" };
  }

  await prisma.reportComment.create({
    data: { reportId, authorId: user.id, body: text },
  });

  revalidateReports();
  return { ok: true, message: "コメントを投稿しました" };
}

/** コメントは投稿者本人のみ削除できる */
export async function deleteCommentAction(
  commentId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const deleted = await prisma.reportComment.deleteMany({
    where: { id: commentId, authorId: user.id },
  });
  if (deleted.count === 0) {
    return { ok: false, error: "コメントが見つからないか、削除権限がありません" };
  }

  revalidateReports();
  return { ok: true, message: "コメントを削除しました" };
}
