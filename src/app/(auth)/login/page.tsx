import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "ログイン | 経費管理システム" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-semibold text-primary">
            Expense Portal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-ui">
            経費管理システム
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-xs text-muted-foreground font-ui leading-relaxed">
          アカウントの発行は管理者またはオーナーが行います。
          <br />
          ログインできない場合は管理者にお問い合わせください。
        </p>
      </div>
    </main>
  );
}
