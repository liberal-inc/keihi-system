import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import type { SessionUser } from "@/lib/auth-types";

export {
  ROLE_LABEL,
  isAdminLike,
  canCommentOnReports,
  type SessionUser,
} from "@/lib/auth-types";

const COOKIE_NAME = "keihi_session";
const SESSION_DAYS = 7;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET が未設定、または短すぎます");
  }
  return new TextEncoder().encode(secret);
}

/** ログイン成功時にセッション Cookie を発行する */
export async function createSession(userId: string): Promise<void> {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * 現在のセッションユーザーを返す。未ログインなら null。
 * 1 リクエスト内では React cache により DB アクセスは 1 回に集約される。
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string") return null;
    userId = payload.sub;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { department: true, managedDepartment: true },
  });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    loginName: user.loginName,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    managedDepartmentId: user.managedDepartment?.id ?? null,
  };
});

/** 未ログインならログイン画面へリダイレクトする */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** 指定ロールのいずれかを持たない場合はダッシュボードへ戻す */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

