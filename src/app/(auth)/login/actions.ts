"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  loginName: z
    .string()
    .min(1, "お名前を入力してください")
    .max(50, "お名前が長すぎます"),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // 全角・半角スペースを除いて照合するため、入力を正規化する
  const raw = String(formData.get("loginName") ?? "").replace(/[\s　]/g, "");

  const parsed = loginSchema.safeParse({ loginName: raw });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "お名前を入力してください" };
  }

  const user = await prisma.user.findUnique({
    where: { loginName: parsed.data.loginName },
  });

  if (!user || !user.isActive) {
    return { error: "お名前が見つかりません。入力内容をご確認ください" };
  }

  await createSession(user.id);
  redirect("/dashboard");
}
