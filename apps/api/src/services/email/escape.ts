/**
 * メールテンプレート用 HTML エスケープユーティリティ
 */

/**
 * ユーザー入力を HTML 内に安全に埋め込むためにエスケープする
 *
 * @param s - エスケープ対象の文字列
 * @returns HTML エスケープ済みの文字列
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
