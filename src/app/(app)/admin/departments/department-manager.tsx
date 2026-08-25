"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Pencil, Plus, Trash2, UserMinus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeedbackBanner, type Feedback } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABEL } from "@/lib/auth-types";
import type { Role } from "@/generated/prisma";
import {
  assignMemberAction,
  createDepartmentAction,
  deleteDepartmentAction,
  renameDepartmentAction,
  setManagerAction,
} from "./actions";

type Member = {
  id: string;
  name: string;
  employeeNo: string | null;
  role: Role;
};

type DepartmentView = {
  id: string;
  name: string;
  managerId: string | null;
  managerName: string | null;
  members: Member[];
};

const NO_MANAGER = "__none__";

export function DepartmentManager({
  departments,
  unassigned,
}: {
  departments: DepartmentView[];
  unassigned: Member[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setFeedback(null);
    startTransition(async () => {
      const res = await fn();
      setFeedback(
        res.ok
          ? { kind: "success", message: res.message ?? "完了しました" }
          : { kind: "error", message: res.error ?? "失敗しました" },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 部署の追加 */}
      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-semibold font-ui">部署を追加</h2>
          <div className="flex flex-wrap gap-2">
            <Input
              value={newName}
              placeholder="部署名（例: 制作部）"
              className="max-w-xs"
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button
              disabled={pending || newName.trim() === ""}
              onClick={() =>
                run(async () => {
                  const res = await createDepartmentAction(newName);
                  if (res.ok) setNewName("");
                  return res;
                })
              }
            >
              <Plus className="size-4" />
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      <FeedbackBanner feedback={feedback} />

      {/* 部署一覧 */}
      {departments.map((d) => (
        <Card key={d.id}>
          <CardContent className="pt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              {editingId === d.id ? (
                <div className="flex flex-1 flex-wrap gap-2">
                  <Input
                    value={editName}
                    className="max-w-xs"
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={pending || editName.trim() === ""}
                    onClick={() =>
                      run(async () => {
                        const res = await renameDepartmentAction(d.id, editName);
                        if (res.ok) setEditingId(null);
                        return res;
                      })
                    }
                  >
                    <Check className="size-3.5" />
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="size-3.5" />
                    やめる
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-primary">
                      {d.name}
                    </h3>
                    <p className="text-xs text-muted-foreground font-ui">
                      {d.members.length} 名
                      {d.managerName
                        ? ` · マネージャー: ${d.managerName}`
                        : " · マネージャー未設定"}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(d.id);
                        setEditName(d.name);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      名前を変更
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="部署を削除"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={pending}
                      onClick={() => {
                        const extra =
                          d.members.length > 0
                            ? `\n\n所属している ${d.members.length} 名は「部署なし」になります（社員は削除されません）。`
                            : "";
                        if (!confirm(`部署「${d.name}」を削除します。よろしいですか？${extra}`))
                          return;
                        run(() => deleteDepartmentAction(d.id));
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* マネージャー設定 */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium font-ui">マネージャー</span>
              <div className="w-56">
                <Select
                  value={d.managerId ?? NO_MANAGER}
                  onValueChange={(v) =>
                    run(() => setManagerAction(d.id, v === NO_MANAGER ? null : v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MANAGER}>未設定</SelectItem>
                    {d.members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-muted-foreground font-ui">
                この部署に所属する社員から選べます
              </span>
            </div>

            {/* メンバー一覧 */}
            {d.members.length === 0 ? (
              <p className="rounded-md border border-border bg-secondary/30 px-4 py-4 text-center text-sm text-muted-foreground font-ui">
                所属メンバーがいません。
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {d.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm font-ui"
                  >
                    <span className="min-w-0 flex-1">
                      {m.name}
                      {m.employeeNo && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          No.{m.employeeNo}
                        </span>
                      )}
                    </span>
                    <Badge variant="secondary">{ROLE_LABEL[m.role]}</Badge>
                    {d.managerId === m.id && <Badge>マネージャー</Badge>}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      title="この部署から外す"
                      onClick={() => run(() => assignMemberAction(m.id, null))}
                    >
                      <UserMinus className="size-3.5" />
                      外す
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {/* メンバー追加 */}
            {unassigned.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-ui">メンバーを追加</span>
                <div className="w-56">
                  <Select
                    value=""
                    onValueChange={(v) => run(() => assignMemberAction(v, d.id))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="部署なしの社員から選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassigned.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {departments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground font-ui">
              まだ部署がありません。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 部署なしの社員 */}
      {unassigned.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="mb-3 text-sm font-semibold font-ui">
              部署なしの社員（{unassigned.length} 名）
            </h2>
            <ul className="divide-y divide-border rounded-md border border-border">
              {unassigned.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm font-ui"
                >
                  <span className="min-w-0 flex-1">{u.name}</span>
                  <Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge>
                  <div className="w-44">
                    <Select
                      value=""
                      onValueChange={(v) => run(() => assignMemberAction(u.id, v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="部署に配属" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
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
      )}

      <p className="text-xs text-muted-foreground font-ui">
        マネージャーは担当部署の社員の日報を閲覧・コメントできます。
        部署を削除しても社員は削除されず、「部署なし」に移ります。
      </p>
    </div>
  );
}
