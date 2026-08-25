import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoryManager } from "./category-manager";

export const metadata = { title: "小物カテゴリ設定 | 経費管理システム" };

export default async function CategoriesPage() {
  await requireRole("admin", "owner");

  const categories = await prisma.itemCategory.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { entries: true } } },
  });

  return (
    <>
      <PageHeader
        title="小物カテゴリ設定"
        description="社員が「小物（カテゴリ一覧）」タブから選べる品目を管理します。"
      />
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          unitCost: c.unitCost,
          unit: c.unit,
          isActive: c.isActive,
          usageCount: c._count.entries,
        }))}
      />
    </>
  );
}
