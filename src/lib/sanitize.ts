import "server-only";

import sanitizeHtml from "sanitize-html";

/**
 * 日報のリッチテキストを保存・表示する前にサニタイズする。
 * エディタ（Tiptap StarterKit）が生成しうるタグだけを許可する。
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "s",
      "u",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "hr",
    ],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}

/** HTML からタグを除いた文字数（必須チェック・一覧のプレビュー用） */
export function richTextToPlain(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
