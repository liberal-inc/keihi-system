import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit は実行時にフォント等のファイルを読み込むため、バンドルせず
  // Node.js の require に任せる
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
