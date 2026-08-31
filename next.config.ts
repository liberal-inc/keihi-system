import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit は実行時にフォント等のファイルを読み込むため、バンドルせず
  // Node.js の require に任せる
  serverExternalPackages: ["pdfkit", "sharp"],

  experimental: {
    serverActions: {
      // Server Action の既定上限は 1MB。スマホで撮った領収書は数MBあるため引き上げる。
      // クライアント側でも送信前に縮小しているが、縮小できない場合の余裕を見て 12MB。
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
