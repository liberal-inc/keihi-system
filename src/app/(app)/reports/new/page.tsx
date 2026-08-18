import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/utils";
import { ReportForm } from "./report-form";

export const metadata = { title: "日報を書く | 経費管理システム" };

export default async function NewReportPage({
  searchParams,
}: PageProps<"/reports/new">) {
  const user = await requireUser();
  const params = await searchParams;

  // 既存の下書きを編集する場合は ?id= で指定される
  const editId = typeof params.id === "string" ? params.id : null;
  const report = editId
    ? await prisma.dailyReport.findFirst({
        where: { id: editId, userId: user.id },
      })
    : null;

  return (
    <>
      <PageHeader
        title={report ? "日報を編集" : "日報を書く"}
        description="下書き保存してから、後で提出することもできます。"
      />
      <ReportForm
        initial={
          report
            ? {
                id: report.id,
                reportDate: report.reportDate.toISOString().slice(0, 10),
                content: report.content,
                reflection: report.reflection ?? "",
                nextPlan: report.nextPlan ?? "",
                status: report.status,
              }
            : {
                id: null,
                reportDate: toDateKey(new Date()),
                content: "",
                reflection: "",
                nextPlan: "",
                status: "draft",
              }
        }
      />
    </>
  );
}
