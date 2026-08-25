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
import heicConvert from "heic-convert";

/**
 * 領収書画像の保存先。
 * 本番は Cloudflare R2 (S3互換)、R2 の環境変数が未設定ならローカルの
 * ./.storage 配下にフォールバックする（ローカル動作確認用）。
 */

/**
 * アップロードを受け付ける形式。
 * HEIC は iPhone の標準形式だが、ブラウザで表示できず PDF にも埋め込めないため、
 * 保存前に JPEG へ変換する（normalizeReceipt）。
 */
export const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** ファイル選択ダイアログに渡す accept 属性 */
export const RECEIPT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

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

/**
 * HEIC / HEIF かどうかをファイルの中身から判定する。
 * iPhone からの送信では MIME タイプが空だったり application/octet-stream に
 * なることがあるため、拡張子や申告値ではなく実データで見る。
 *
 * ISO base media 形式: [4byte size]["ftyp"][major brand]...
 */
function isHeicBuffer(bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  if (bytes.toString("ascii", 4, 8) !== "ftyp") return false;

  const brand = bytes.toString("ascii", 8, 12);
  return ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"].includes(
    brand,
  );
}

/**
 * 実データの先頭バイトから対応形式かどうかを判定する。
 * iPhone から HEIC を送ると MIME タイプが空や application/octet-stream に
 * なることがあるため、申告値だけで弾かないようにするために使う。
 */
export function isSupportedReceipt(bytes: Buffer, mimeType: string): boolean {
  if (ALLOWED_RECEIPT_TYPES.includes(mimeType as never)) return true;
  if (isHeicBuffer(bytes)) return true;

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true;
  }
  // PNG: 89 50 4E 47
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes.toString("ascii", 1, 4) === "PNG"
  ) {
    return true;
  }
  // WebP: "RIFF"...."WEBP"
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return true;
  }

  return false;
}

/**
 * 保存できる形式に整える。
 * HEIC はブラウザで表示できず PDF にも埋め込めないため JPEG に変換する。
 */
async function normalizeReceipt(
  bytes: Buffer,
  mimeType: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const declaredHeic = mimeType === "image/heic" || mimeType === "image/heif";

  if (!declaredHeic && !isHeicBuffer(bytes)) {
    return { bytes, contentType: mimeType };
  }

  try {
    const converted = await heicConvert({
      buffer: new Uint8Array(bytes),
      format: "JPEG",
      quality: 0.85,
    });
    return { bytes: Buffer.from(converted), contentType: "image/jpeg" };
  } catch (e) {
    console.error("HEIC の変換に失敗しました", e);
    throw new Error(
      "この画像を読み込めませんでした。JPEG または PNG で保存し直してお試しください。",
    );
  }
}

/** 領収書を保存し、オブジェクトキーと保存後の形式を返す */
export async function putReceipt(
  userId: string,
  rawBytes: Buffer,
  rawMimeType: string,
): Promise<{ key: string; contentType: string }> {
  assertStorageReady();

  const { bytes, contentType } = await normalizeReceipt(rawBytes, rawMimeType);

  const key = `receipts/${userId}/${randomUUID()}.${extFor(contentType)}`;
  const cfg = r2Config();

  if (cfg) {
    await client(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
    return { key, contentType };
  }

  const filePath = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  return { key, contentType };
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
