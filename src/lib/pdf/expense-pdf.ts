import "server-only";

import path from "node:path";
import PDFDocument from "pdfkit";

import { formatJpDate, formatJpMonth, weekdayJp } from "@/lib/utils";

/**
 * 経費申請 PDF の生成。
 * 仕様書「PDF出力機能」の項目をそのまま帳票化する。
 */

const FONT_PATH = path.join(process.cwd(), "src/assets/fonts/NotoSansJP.ttf");

const PAGE_MARGIN = 48;
const A4_WIDTH = 595.28;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;

// 落ち着いたウォームベージュ系（画面デザインに合わせる）
const COLOR = {
  text: "#2b2118",
  muted: "#6b5d4f",
  line: "#d9d0c3",
  headerBg: "#efe8dc",
  totalBg: "#e3d8c6",
};

export type PdfApplication = {
  id: string;
  userName: string;
  employeeNo: string | null;
  departmentName: string | null;
  targetMonth: Date;
  status: "draft" | "submitted";
  submittedAt: Date | null;
  commuteEntries: { date: Date; routeNameSnapshot: string; amount: number }[];
  itemEntries: {
    nameSnapshot: string;
    quantity: number;
    unitSnapshot: string;
    amount: number;
  }[];
  freeItemEntries: {
    name: string;
    amount: number;
    receipt: { body: Buffer; contentType: string } | null;
  }[];
};

const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;

type Doc = InstanceType<typeof PDFDocument>;

function newDocument(): Doc {
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    autoFirstPage: false,
    info: { Title: "経費申請書", Creator: "経費管理システム" },
  });
  doc.registerFont("jp", FONT_PATH);
  doc.font("jp");
  return doc;
}

/** ページ下端に達しそうなら改ページする */
function ensureSpace(doc: Doc, needed: number) {
  const bottom = doc.page.height - PAGE_MARGIN;
  if (doc.y + needed > bottom) doc.addPage();
}

function drawHeader(doc: Doc, app: PdfApplication) {
  doc
    .fontSize(20)
    .fillColor(COLOR.text)
    .text("経費申請書", PAGE_MARGIN, PAGE_MARGIN);

  doc
    .fontSize(13)
    .fillColor(COLOR.muted)
    .text(formatJpMonth(app.targetMonth) + " 分", { align: "right" });

  doc.moveDown(0.8);

  const top = doc.y;
  doc
    .moveTo(PAGE_MARGIN, top)
    .lineTo(A4_WIDTH - PAGE_MARGIN, top)
    .lineWidth(1)
    .strokeColor(COLOR.line)
    .stroke();

  doc.y = top + 12;

  // 氏名・対象月・提出日・ステータス
  const rows: [string, string][] = [
    ["氏名", app.userName + (app.employeeNo ? `（社員番号 ${app.employeeNo}）` : "")],
    ["部署", app.departmentName ?? "—"],
    ["対象月", formatJpMonth(app.targetMonth)],
    [
      "提出日",
      app.submittedAt ? formatJpDate(app.submittedAt) : "—（未提出）",
    ],
    ["ステータス", app.status === "submitted" ? "提出済み" : "下書き"],
  ];

  doc.fontSize(10);
  for (const [label, value] of rows) {
    const y = doc.y;
    doc.fillColor(COLOR.muted).text(label, PAGE_MARGIN, y, { width: 70 });
    doc.fillColor(COLOR.text).text(value, PAGE_MARGIN + 78, y, {
      width: CONTENT_WIDTH - 78,
    });
    doc.y = Math.max(doc.y, y) + 3;
  }

  doc.moveDown(0.8);
}

/**
 * 明細テーブルを描画する。
 * columns の width 合計は CONTENT_WIDTH に一致させること。
 */
function drawTable(
  doc: Doc,
  title: string,
  columns: { label: string; width: number; align?: "left" | "right" }[],
  rows: string[][],
  subtotal: number,
) {
  ensureSpace(doc, 90);

  doc.fontSize(11).fillColor(COLOR.text).text(title, PAGE_MARGIN, doc.y);
  doc.moveDown(0.4);

  const drawHeaderRow = () => {
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 20).fill(COLOR.headerBg);

    let x = PAGE_MARGIN;
    doc.fontSize(9).fillColor(COLOR.muted);
    for (const col of columns) {
      doc.text(col.label, x + 6, y + 6, {
        width: col.width - 12,
        align: col.align ?? "left",
      });
      x += col.width;
    }
    doc.y = y + 20;
  };

  drawHeaderRow();

  if (rows.length === 0) {
    const y = doc.y;
    doc
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text("該当なし", PAGE_MARGIN + 6, y + 6, { width: CONTENT_WIDTH - 12 });
    doc.y = y + 22;
  }

  for (const row of rows) {
    // 行が入りきらない場合は改ページし、ヘッダー行を引き継ぐ
    if (doc.y + 20 > doc.page.height - PAGE_MARGIN) {
      doc.addPage();
      drawHeaderRow();
    }

    const y = doc.y;
    let x = PAGE_MARGIN;
    doc.fontSize(9).fillColor(COLOR.text);
    for (let i = 0; i < columns.length; i++) {
      doc.text(row[i] ?? "", x + 6, y + 6, {
        width: columns[i].width - 12,
        align: columns[i].align ?? "left",
        lineBreak: false,
        ellipsis: true,
      });
      x += columns[i].width;
    }

    doc
      .moveTo(PAGE_MARGIN, y + 20)
      .lineTo(A4_WIDTH - PAGE_MARGIN, y + 20)
      .lineWidth(0.5)
      .strokeColor(COLOR.line)
      .stroke();

    doc.y = y + 20;
  }

  // 小計行
  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 20).fill(COLOR.headerBg);
  doc
    .fontSize(9)
    .fillColor(COLOR.text)
    .text("小計", PAGE_MARGIN + 6, y + 6, {
      width: CONTENT_WIDTH - 120,
      align: "right",
    });
  doc.text(yen(subtotal), PAGE_MARGIN + CONTENT_WIDTH - 110, y + 6, {
    width: 104,
    align: "right",
  });

  doc.y = y + 20;
  doc.moveDown(1);
}

function drawTotal(doc: Doc, total: number) {
  ensureSpace(doc, 50);

  const y = doc.y;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 32).fill(COLOR.totalBg);
  doc
    .fontSize(12)
    .fillColor(COLOR.text)
    .text("合計金額", PAGE_MARGIN + 12, y + 10);
  doc
    .fontSize(14)
    .text(yen(total), PAGE_MARGIN, y + 8, {
      width: CONTENT_WIDTH - 12,
      align: "right",
    });

  doc.y = y + 32;
}

/** 領収書画像を 1 枚 1 ページで添付する */
function drawReceipts(doc: Doc, app: PdfApplication) {
  const withReceipt = app.freeItemEntries.filter((e) => e.receipt);
  if (withReceipt.length === 0) return;

  for (const entry of withReceipt) {
    doc.addPage();

    doc
      .fontSize(13)
      .fillColor(COLOR.text)
      .text("領収書", PAGE_MARGIN, PAGE_MARGIN);
    doc
      .fontSize(10)
      .fillColor(COLOR.muted)
      .text(`${entry.name} ／ ${yen(entry.amount)}`);

    doc.moveDown(0.8);

    const top = doc.y;
    const maxHeight = doc.page.height - top - PAGE_MARGIN;

    try {
      doc.image(entry.receipt!.body, PAGE_MARGIN, top, {
        fit: [CONTENT_WIDTH, maxHeight],
        align: "center",
      });
    } catch {
      // WebP など pdfkit が扱えない形式は画像を省略し、その旨を明記する
      doc
        .fontSize(9)
        .fillColor(COLOR.muted)
        .text(
          "※ この領収書画像は PDF に埋め込めない形式のため、システム上で確認してください。",
          PAGE_MARGIN,
          top,
          { width: CONTENT_WIDTH },
        );
    }
  }
}

/** 申請 1 件分のページ群を既存のドキュメントに書き込む */
function writeApplication(doc: Doc, app: PdfApplication) {
  doc.addPage();
  drawHeader(doc, app);

  const commuteTotal = app.commuteEntries.reduce((s, e) => s + e.amount, 0);
  const itemTotal = app.itemEntries.reduce((s, e) => s + e.amount, 0);
  const freeTotal = app.freeItemEntries.reduce((s, e) => s + e.amount, 0);

  // 通勤費明細（日付・経路名・金額）
  drawTable(
    doc,
    "通勤費明細",
    [
      { label: "日付", width: 110 },
      { label: "経路名", width: 269 },
      { label: "金額", width: 120, align: "right" },
    ],
    app.commuteEntries.map((e) => {
      const key = e.date.toISOString().slice(0, 10);
      return [
        `${formatJpDate(key)}（${weekdayJp(key)}）`,
        e.routeNameSnapshot,
        yen(e.amount),
      ];
    }),
    commuteTotal,
  );

  // 小物購入費明細（品目名・数量・金額）
  drawTable(
    doc,
    "小物購入費明細",
    [
      { label: "品目名", width: 269 },
      { label: "数量", width: 110, align: "right" },
      { label: "金額", width: 120, align: "right" },
    ],
    app.itemEntries.map((e) => [
      e.nameSnapshot,
      `${e.quantity} ${e.unitSnapshot}`,
      yen(e.amount),
    ]),
    itemTotal,
  );

  // 自由入力品目明細（品目名・金額）
  drawTable(
    doc,
    "自由入力品目明細",
    [
      { label: "品目名", width: 299 },
      { label: "領収書", width: 80, align: "right" },
      { label: "金額", width: 120, align: "right" },
    ],
    app.freeItemEntries.map((e) => [
      e.name,
      e.receipt ? "あり" : "—",
      yen(e.amount),
    ]),
    freeTotal,
  );

  drawTotal(doc, commuteTotal + itemTotal + freeTotal);

  drawReceipts(doc, app);
}

function finish(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/** 申請 1 件の PDF */
export async function buildExpensePdf(app: PdfApplication): Promise<Buffer> {
  const doc = newDocument();
  writeApplication(doc, app);
  return finish(doc);
}

/** 複数申請を 1 つの PDF にまとめる（管理者の一括出力用） */
export async function buildBulkExpensePdf(
  apps: PdfApplication[],
): Promise<Buffer> {
  const doc = newDocument();

  if (apps.length === 0) {
    doc.addPage();
    doc
      .fontSize(12)
      .fillColor(COLOR.muted)
      .text("対象の申請がありません。", PAGE_MARGIN, PAGE_MARGIN);
  } else {
    for (const app of apps) writeApplication(doc, app);
  }

  return finish(doc);
}

/** ダウンロード時のファイル名 */
export function pdfFileName(app: {
  userName: string;
  targetMonth: Date;
}): string {
  const month = app.targetMonth.toISOString().slice(0, 7);
  // 記号や空白はファイル名として扱いにくいため落とす
  const name = app.userName.replace(/[\s\/\\:*?"<>|]/g, "");
  return `経費申請_${month}_${name}.pdf`;
}
