"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Send } from "lucide-react";

import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/input";
import { formatJpDate, weekdayJp } from "@/lib/utils";
import { saveReportAction } from "../actions";

type Initial = {
  id: string | null;
  reportDate: string;
  content: string;
  reflection: string;
  nextPlan: string;
  status: "draft" | "submitted";
};

/** HTML から本文が空かどうかを判定する（Tiptap は空でも <p></p> を返す） */
function isEmptyHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}

export function ReportForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [reportDate, setReportDate] = useState(initial.reportDate);
  const [content, setContent] = useState(initial.content);
  const [reflection, setReflection] = useState(initial.reflection);
  const [nextPlan, setNextPlan] = useState(initial.nextPlan);

  const readOnly = initial.status === "submitted";
  const canSave = !readOnly && !isEmptyHtml(content);

  function save(status: "draft" | "submitted") {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveReportAction({
        id: initial.id ?? undefined,
        reportDate,
        content,
        reflection,
        nextPlan,
        status,
      });

      if (res.ok) {
        setFeedback({ kind: "success", message: res.message });
        router.push("/reports");
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  if (readOnly) {
    return (
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground font-ui">
            この日報はすでに提出済みのため編集できません。
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => router.push("/reports")}
          >
            日報一覧へ
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-date">対象日</Label>
            <div className="flex items-center gap-3">
              <Input
                id="report-date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-48"
                disabled={Boolean(initial.id)}
              />
              {/^\d{4}-\d{2}-\d{2}$/.test(reportDate) && (
                <span className="text-sm text-muted-foreground font-ui">
                  {formatJpDate(reportDate)}（{weekdayJp(reportDate)}）
                </span>
              )}
            </div>
            {initial.id && (
              <p className="text-xs text-muted-foreground font-ui">
                作成済みの日報の対象日は変更できません。
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              業務内容 <span className="text-destructive">*</span>
            </Label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="本日の業務内容を記入してください"
              minHeight={200}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>振り返り（任意）</Label>
            <RichTextEditor
              value={reflection}
              onChange={setReflection}
              placeholder="うまくいった点・課題など"
              minHeight={120}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>翌日の予定（任意）</Label>
            <RichTextEditor
              value={nextPlan}
              onChange={setNextPlan}
              placeholder="明日取り組む予定の業務"
              minHeight={120}
            />
          </div>

          <FeedbackBanner feedback={feedback} />

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={pending || !canSave}
              onClick={() => save("draft")}
            >
              <Save className="size-4" />
              下書き保存
            </Button>
            <Button disabled={pending || !canSave} onClick={() => save("submitted")}>
              <Send className="size-4" />
              {pending ? "処理中…" : "提出する"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
