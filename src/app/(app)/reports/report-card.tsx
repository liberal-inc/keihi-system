"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageSquare, Pencil, Send, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { cn, formatJpDate, weekdayJp } from "@/lib/utils";
import {
  addCommentAction,
  deleteCommentAction,
  deleteReportAction,
  submitReportAction,
} from "./actions";

type Comment = {
  id: string;
  authorName: string;
  isOwnComment: boolean;
  body: string;
  createdAt: string;
};

type Report = {
  id: string;
  authorName: string;
  isOwn: boolean;
  reportDate: string;
  content: string;
  reflection: string | null;
  nextPlan: string | null;
  status: "draft" | "submitted";
  comments: Comment[];
};

function Section({ title, html }: { title: string; html: string }) {
  return (
    <section>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground font-ui">
        {title}
      </h4>
      {/* 保存時にサーバー側でサニタイズ済み（@/lib/sanitize） */}
      <div
        className="rich-text text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

export function ReportCard({
  report,
  canComment,
}: {
  report: Report;
  canComment: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [commentBody, setCommentBody] = useState("");

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setFeedback(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setFeedback({ kind: "success", message: res.message ?? "完了しました" });
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: res.error ?? "失敗しました" });
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-display text-xl font-semibold text-primary">
                  {formatJpDate(report.reportDate)}（{weekdayJp(report.reportDate)}）
                </span>
                <StatusBadge status={report.status} />
              </p>
              <p className="text-xs text-muted-foreground font-ui">
                {report.authorName}
                {report.comments.length > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <MessageSquare className="size-3" />
                    {report.comments.length}
                  </span>
                )}
              </p>
            </div>
          </button>

          {report.isOwn && (
            <div className="flex shrink-0 gap-1">
              {report.status === "draft" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/reports/new?id=${report.id}`)}
                  >
                    <Pencil className="size-3.5" />
                    編集
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => submitReportAction(report.id))}
                  >
                    <Send className="size-3.5" />
                    提出
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                title="日報を削除"
                className="text-destructive hover:bg-destructive/10"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`${formatJpDate(report.reportDate)}の日報を削除します。よろしいですか？`))
                    return;
                  run(() => deleteReportAction(report.id));
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        <FeedbackBanner feedback={feedback} className="mt-3" />

        {open && (
          <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4 animate-fade-in">
            <Section title="業務内容" html={report.content} />
            {report.reflection && (
              <Section title="振り返り" html={report.reflection} />
            )}
            {report.nextPlan && (
              <Section title="翌日の予定" html={report.nextPlan} />
            )}

            {/* コメント */}
            <section className="border-t border-border pt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground font-ui">
                コメント
              </h4>

              {report.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground font-ui">
                  まだコメントはありません。
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {report.comments.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-md border border-border bg-secondary/40 px-3 py-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-medium font-ui">
                          {c.authorName}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {formatJpDate(c.createdAt.slice(0, 10))}
                          </span>
                        </p>
                        {c.isOwnComment && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="コメントを削除"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={pending}
                            onClick={() => run(() => deleteCommentAction(c.id))}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm font-ui">
                        {c.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {canComment && report.status === "submitted" && (
                <div className="mt-3 flex flex-col gap-2">
                  <Textarea
                    value={commentBody}
                    placeholder="コメントを入力"
                    onChange={(e) => setCommentBody(e.target.value)}
                    className="min-h-16"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={pending || commentBody.trim() === ""}
                      onClick={() =>
                        run(async () => {
                          const res = await addCommentAction(report.id, commentBody);
                          if (res.ok) setCommentBody("");
                          return res;
                        })
                      }
                    >
                      コメントする
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
