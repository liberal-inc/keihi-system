"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { loginAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "ログイン中…" : "ログイン"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loginName">お名前</Label>
            <Input
              id="loginName"
              name="loginName"
              type="text"
              autoComplete="username"
              autoFocus
              required
              placeholder="例: 齋藤"
              className="text-lg"
            />
            <p className="text-xs text-muted-foreground font-ui">
              登録されているお名前を入力してください。
            </p>
          </div>

          {state.error && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive font-ui"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
