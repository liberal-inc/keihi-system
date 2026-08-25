"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABEL } from "@/lib/auth-types";
import type { Role } from "@/generated/prisma";
import { changeRoleAction } from "./actions";

type UserView = {
  id: string;
  name: string;
  loginName: string;
  employeeNo: string | null;
  role: Role;
  departmentName: string | null;
  managedDepartmentName: string | null;
  isActive: boolean;
};

const ROLES: Role[] = ["owner", "admin", "manager", "user"];

const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "全機能・全社員データへのフルアクセス。ロール変更も可能",
  admin: "経費精算の管理。担当部署の社員の申請を操作・削除できる",
  manager: "担当部署の社員の日報のみ閲覧・コメントできる",
  user: "自分の経費申請・日報のみ操作できる",
};

export function RoleManager({
  actorId,
  canChange,
  users,
}: {
  actorId: string;
  canChange: boolean;
  users: UserView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function change(userId: string, role: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await changeRoleAction(userId, role);
      setFeedback(
        res.ok
          ? { kind: "success", message: res.message }
          : { kind: "error", message: res.error },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {!canChange && (
        <p className="flex items-start gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-sm text-muted-foreground font-ui">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          ロールの変更はオーナーのみ実行できます。ここでは確認のみ可能です。
        </p>
      )}

      <FeedbackBanner feedback={feedback} />

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium font-ui">{u.name}</span>
                    {u.id === actorId && <Badge variant="outline">自分</Badge>}
                    {!u.isActive && <Badge variant="destructive">無効</Badge>}
                    {u.managedDepartmentName && (
                      <Badge variant="secondary">
                        {u.managedDepartmentName} 担当
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground font-ui">
                    ログイン名 {u.loginName}
                    {u.employeeNo && ` · No.${u.employeeNo}`}
                    {` · ${u.departmentName ?? "部署未設定"}`}
                  </p>
                </div>

                <div className="w-40 shrink-0">
                  <Select
                    value={u.role}
                    disabled={!canChange || pending}
                    onValueChange={(v) => change(u.id, v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-semibold font-ui">ロールの権限</h2>
          <ul className="divide-y divide-border rounded-md border border-border">
            {ROLES.map((r) => (
              <li key={r} className="flex flex-wrap gap-3 px-3 py-2 text-sm font-ui">
                <span className="w-28 shrink-0 font-medium">{ROLE_LABEL[r]}</span>
                <span className="min-w-0 flex-1 text-muted-foreground">
                  {ROLE_DESCRIPTION[r]}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
