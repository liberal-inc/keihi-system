"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserPen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { ROLE_LABEL } from "@/lib/auth-types";
import { cn } from "@/lib/utils";
import type { Role } from "@/generated/prisma";
import { deleteUserAction } from "./actions";
import { UserDialog, type DepartmentView, type UserView } from "./user-dialog";

export function UserManager({
  actorId,
  actorRole,
  users,
  departments,
}: {
  actorId: string;
  actorRole: Role;
  users: UserView[];
  departments: DepartmentView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [dialogUser, setDialogUser] = useState<UserView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function remove(user: UserView) {
    const extra =
      user.applicationCount + user.reportCount > 0
        ? `\n\nこの社員の経費申請 ${user.applicationCount} 件と日報 ${user.reportCount} 件もすべて削除されます。`
        : "";
    if (!confirm(`${user.name} さんを削除します。よろしいですか？${extra}`)) return;

    startTransition(async () => {
      const res = await deleteUserAction(user.id);
      setFeedback(
        res.ok
          ? { kind: "success", message: res.message }
          : { kind: "error", message: res.error },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground font-ui">
          登録社員 {users.length} 名
        </p>
        <Button
          onClick={() => {
            setDialogUser(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          社員を追加
        </Button>
      </div>

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
                    <Badge variant={u.role === "user" ? "secondary" : "default"}>
                      {ROLE_LABEL[u.role]}
                    </Badge>
                    {!u.isActive && <Badge variant="destructive">無効</Badge>}
                    {u.id === actorId && <Badge variant="outline">自分</Badge>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground font-ui">
                    ログイン名{" "}
                    <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                      {u.loginName}
                    </span>
                    {u.employeeNo && ` · No.${u.employeeNo}`}
                    {` · ${u.departmentName ?? "部署未設定"}`}
                    {` · 申請 ${u.applicationCount} 件 / 日報 ${u.reportCount} 件`}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDialogUser(u);
                      setDialogOpen(true);
                    }}
                  >
                    <UserPen className="size-3.5" />
                    編集
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="削除"
                    className={cn(
                      "text-destructive hover:bg-destructive/10",
                      u.id === actorId && "invisible",
                    )}
                    disabled={pending || u.id === actorId}
                    onClick={() => remove(u)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground font-ui">
        ロールの変更はオーナーのみ実行できます。
        社員を削除すると、その社員の経費申請・日報もすべて削除されます。
      </p>

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={dialogUser}
        departments={departments}
        canChangeRole={actorRole === "owner"}
        onSaved={(message) => {
          setFeedback({ kind: "success", message });
          router.refresh();
        }}
      />
    </div>
  );
}
