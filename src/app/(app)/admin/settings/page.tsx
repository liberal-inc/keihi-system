import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth";
import { getRatePerKm } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "システム設定 | 経費管理システム" };

export default async function SettingsPage() {
  await requireRole("admin", "owner");
  const ratePerKm = await getRatePerKm();

  return (
    <>
      <PageHeader
        title="システム設定"
        description="車通勤の交通費計算に使う単価を設定します。"
      />
      <SettingsForm ratePerKm={ratePerKm} />
    </>
  );
}
