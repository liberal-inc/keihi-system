import type { LucideIcon } from "lucide-react";
import {
  BookText,
  Building2,
  ClipboardList,
  FileStack,
  LayoutDashboard,
  Package,
  PenLine,
  Receipt,
  Route,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { Role } from "@/generated/prisma";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 表示を許可するロール。未指定なら全ロール */
  roles?: Role[];
  /** 未実装（次フェーズ）の画面 */
  comingSoon?: boolean;
};

export type NavSection = {
  title: string;
  roles?: Role[];
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "社員メニュー",
    items: [
      { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
      { href: "/expenses/new", label: "経費申請", icon: Receipt },
      { href: "/expenses", label: "申請履歴", icon: FileStack },
      { href: "/reports", label: "日報一覧", icon: BookText },
      // 「日報を書く」は社員のみ表示（仕様書より）
      {
        href: "/reports/new",
        label: "日報を書く",
        icon: PenLine,
        roles: ["user"],
      },
    ],
  },
  {
    title: "管理者メニュー",
    roles: ["admin", "owner"],
    items: [
      { href: "/admin", label: "管理ダッシュボード", icon: ClipboardList },
      { href: "/admin/users", label: "社員管理", icon: Users },
      {
        href: "/admin/routes",
        label: "通勤経路設定",
        icon: Route,
      },
      {
        href: "/admin/categories",
        label: "小物カテゴリ設定",
        icon: Package,
      },
      { href: "/admin/monthly", label: "月次経費一覧", icon: FileStack },
      {
        href: "/admin/departments",
        label: "部署管理",
        icon: Building2,
      },
      {
        href: "/admin/roles",
        label: "ロール管理",
        icon: ShieldCheck,
      },
      {
        href: "/admin/settings",
        label: "システム設定",
        icon: Settings,
      },
    ],
  },
];

export function visibleSections(role: Role): NavSection[] {
  return NAV_SECTIONS.filter((s) => !s.roles || s.roles.includes(role)).map(
    (s) => ({
      ...s,
      items: s.items.filter((i) => !i.roles || i.roles.includes(role)),
    }),
  );
}
