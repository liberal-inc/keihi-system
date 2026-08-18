// クライアントコンポーネントからも参照できる型・定数。
// （@/lib/auth は "server-only" を含むため、こちらに分離している）

import type { Role } from "@/generated/prisma";

export type SessionUser = {
  id: string;
  /** ログイン時に入力する名前 */
  loginName: string;
  email: string | null;
  name: string;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
  managedDepartmentId: string | null;
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "オーナー",
  admin: "管理者",
  manager: "マネージャー",
  user: "社員",
};

export function isAdminLike(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function canCommentOnReports(role: Role): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}
