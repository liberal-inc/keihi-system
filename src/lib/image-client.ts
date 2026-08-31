"use client";

/**
 * 送信前にブラウザ側で画像を縮小する。
 *
 * スマホで撮った写真は数MBあり、そのまま送ると回線が細い場所で失敗しやすい。
 * canvas で長辺 2000px の JPEG に落としてから送る。
 *
 * HEIC はブラウザが描画できないため縮小できない。その場合は元のファイルを
 * そのまま返し、サーバー側で変換・縮小する。
 */

const MAX_DIMENSION = 2000;
const QUALITY = 0.85;

/** ブラウザで読み込める画像かどうか（HEIC は多くのブラウザで不可） */
function isCanvasReadable(file: File): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

export async function shrinkImageForUpload(file: File): Promise<File> {
  if (!isCanvasReadable(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);

    if (longest <= MAX_DIMENSION) {
      bitmap.close();
      return file;
    }

    const scale = MAX_DIMENSION / longest;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // 縮小できなければ元のファイルを送り、サーバー側の処理に任せる
    return file;
  }
}
