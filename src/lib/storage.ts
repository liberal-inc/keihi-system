import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * 領収書画像の保存先。
 * 本番は Cloudflare R2 (S3互換)、R2 の環境変数が未設定ならローカルの
 * ./.storage 配下にフォールバックする（ローカル動作確認用）。
 */

export const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024; // 8MB

const LOCAL_DIR = path.join(process.cwd(), ".storage");

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function isR2Configured(): boolean {
  return r2Config() !== null;
}

/**
 * Railway / Vercel などのコンテナはファイルシステムが揮発性で、
 * 再デプロイのたびにローカル保存した領収書が消える。
 * 本番で R2 未設定のままアップロードを受け付けると気づかないうちに
 * データが失われるため、保存前に明示的に止める。
 */
function assertStorageReady() {
  if (process.env.NODE_ENV === "production" && !isR2Configured()) {
    throw new Error(
      "領収書の保存先（Cloudflare R2）が設定されていません。管理者に連絡してください。",
    );
  }
}

let cachedClient: S3Client | null = null;

function client(cfg: NonNullable<ReturnType<typeof r2Config>>): S3Client {
  cachedClient ??= new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cachedClient;
}

function extFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

/** 領収書を保存し、オブジェクトキーを返す */
export async function putReceipt(
  userId: string,
  bytes: Buffer,
  mimeType: string,
): Promise<string> {
  assertStorageReady();

  const key = `receipts/${userId}/${randomUUID()}.${extFor(mimeType)}`;
  const cfg = r2Config();

  if (cfg) {
    await client(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
      }),
    );
    return key;
  }

  const filePath = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  return key;
}

/** 領収書を取得する（画像配信用） */
export async function getReceipt(
  key: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  const cfg = r2Config();

  if (cfg) {
    try {
      const res = await client(cfg).send(
        new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
      );
      const body = Buffer.from(await res.Body!.transformToByteArray());
      return { body, contentType: res.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  try {
    const body = await readFile(path.join(LOCAL_DIR, key));
    const ext = path.extname(key).slice(1);
    const contentType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";
    return { body, contentType };
  } catch {
    return null;
  }
}

export async function deleteReceipt(key: string): Promise<void> {
  const cfg = r2Config();
  if (cfg) {
    await client(cfg)
      .send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
      .catch(() => undefined);
    return;
  }
  await unlink(path.join(LOCAL_DIR, key)).catch(() => undefined);
}
