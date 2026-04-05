/**
 * パーサー共通ユーティリティ
 * 複数のパーサーで使用する定数・関数を集約する
 */

/** TechClipボットのUser-Agent文字列 */
export const TECHCLIP_USER_AGENT =
  "Mozilla/5.0 (compatible; TechClipBot/1.0; +https://techclip.app)";

/** 抜粋の最大文字数 */
export const EXCERPT_MAX_LENGTH = 200;

/**
 * テキストから抜粋を生成する
 *
 * @param text - 対象テキスト
 * @returns EXCERPT_MAX_LENGTH 以内に切り詰めた抜粋文字列
 */
export function createExcerpt(text: string): string {
  if (text.length <= EXCERPT_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, EXCERPT_MAX_LENGTH)}...`;
}
