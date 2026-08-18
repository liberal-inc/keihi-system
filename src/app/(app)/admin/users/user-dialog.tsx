"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABEL } from "@/lib/auth-types";
import type { Role } from "@/generated/prisma";
import { createDepartmentAction, saveUserAction } from "./actions";

export type DepartmentView = { id: string; name: string };

export type UserView = {
  id: string;
  loginName: string;
  name: string;
  employeeNo: string | null;
  email: string | null;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  applicationCount: number;
  reportCount: number;
};

const NO_DEPARTMENT = "__none__";

type Form = {
  loginName: string;
  name: string;
  employeeNo: string;
  email: string;
  departmentId: string;
  role: Role;
  isActive: boolean;
};

const EMPTY: Form = {
  loginName: "",
  name: "",
  employeeNo: "",
  email: "",
  departmentId: NO_DEPARTMENT,
  role: "user",
  isActive: true,
};

export function UserDialog({
  open,
  onOpenChange,
  user,
  departments,
  canChangeRole,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserView | null;
  departments: DepartmentView[];
  canChangeRole: boolean;
  onSaved: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [newDept, setNewDept] = useState("");
  const [showNewDept, setShowNewDept] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFeedback(null);
    setNewDept("");
    setShowNewDept(false);
    setForm(
      user
        ? {
            loginName: user.loginName,
            name: user.name,
            employeeNo: user.employeeNo ?? "",
            email: user.email ?? "",
            departmentId: user.departmentId ?? NO_DEPARTMENT,
            role: user.role,
            isActive: user.isActive,
          }
        : EMPTY,
    );
  }, [open, user]);

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveUserAction({
        id: user?.id,
        loginName: form.loginName,
        name: form.name,
        employeeNo: form.employeeNo || null,
        email: form.email || null,
        departmentId:
          form.departmentId === NO_DEPARTMENT ? null : form.departmentId,
        role: form.role,
        isActive: form.isActive,
      });

      if (res.ok) {
        onOpenChange(false);
        onSaved(res.message);
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  function addDepartment() {
    startTransition(async () => {
      const res = await createDepartmentAction(newDept);
      if (res.ok) {
        setShowNewDept(false);
        setNewDept("");
        setFeedback({ kind: "success", message: res.message });
        // 追加した部署を選択肢に反映させるため一覧を取り直す
        onSaved(res.message);
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  // 氏名を入力したら、未入力のログイン名に姓を補完する
  function onNameChange(value: string) {
    setForm((f) => {
      const surname = value.split(/[\s　]/)[0] ?? "";
      const shouldFill = f.loginName === "" || f.loginName === (f.name.split(/[\s　]/)[0] ?? "");
      return { ...f, name: value, loginName: shouldFill ? surname : f.loginName };
    });
  }

  const canSave = form.loginName.trim() !== "" && form.name.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? "社員情報を編集" : "社員を追加"}</DialogTitle>
          <DialogDescription>
            ログインは「ログイン名」の入力のみです。パスワードはありません。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-name">氏名</Label>
              <Input
                id="u-name"
                value={form.name}
                placeholder="例: 齋藤 健一"
                onChange={(e) => onNameChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-login">
                ログイン名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-login"
                value={form.loginName}
                placeholder="例: 齋藤"
                onChange={(e) =>
                  setForm((f) => ({ ...f, loginName: e.target.value }))
                }
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground font-ui">
            ログイン画面ではこの「ログイン名」を入力します。
            他の社員と重複しない値にしてください。
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-no">社員番号（任意）</Label>
              <Input
                id="u-no"
                value={form.employeeNo}
                placeholder="例: 0003"
                onChange={(e) =>
                  setForm((f) => ({ ...f, employeeNo: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-email">メールアドレス（任意）</Label>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                placeholder="連絡用"
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>部署</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewDept((v) => !v)}
              >
                <Plus className="size-3.5" />
                部署を追加
              </Button>
            </div>

            {showNewDept ? (
              <div className="flex gap-2">
                <Input
                  value={newDept}
                  placeholder="新しい部署名"
                  onChange={(e) => setNewDept(e.target.value)}
                />
                <Button
                  variant="secondary"
                  disabled={pending || !newDept.trim()}
                  onClick={addDepartment}
                >
                  追加
                </Button>
              </div>
            ) : (
              <Select
                value={form.departmentId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, departmentId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>部署なし</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>ロール</Label>
            <Select
              value={form.role}
              disabled={!canChangeRole}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, role: v as Role }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["owner", "admin", "manager", "user"] as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!canChangeRole && (
              <p className="text-xs text-muted-foreground font-ui">
                ロールの変更はオーナーのみ実行できます。
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm font-ui">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
              className="size-4 accent-[hsl(var(--primary))]"
            />
            この社員のログインを有効にする
          </label>

          <FeedbackBanner feedback={feedback} />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            キャンセル
          </Button>
          <Button onClick={save} disabled={pending || !canSave}>
            {pending ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
