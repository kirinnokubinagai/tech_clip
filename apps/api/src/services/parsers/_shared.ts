/**
 * パーサー共通ユーティリティ
 * 複数のパーサーで使用する定数・関数を集約する
 */

/** TechClipボットのUser-Agent文字列 */
export const TECHCLIP_USER_AGENT =
  "Mozilla/5.0 (compatible; TechClipBot/1.0; +https://techclip.app)";

/** 読了速度（文字/分）*/
export const READING_SPEED_CHARS_PER_MIN = 500;

/** 最小読了時間（分） */
export const MIN_READING_TIME_MINUTES = 1;

/** 抜粋の最大文字数 */
export const EXCERPT_MAX_LENGTH = 200;

/**
 * テキストの読了時間を計算する
 *
 * @param text - 対象テキスト
 * @returns 読了時間（分）。最小値は MIN_READING_TIME_MINUTES
 */
export function calculateReadingTime(text: string): number {
  const charCount = text.length;
  const minutes = Math.ceil(charCount / READING_SPEED_CHARS_PER_MIN);
  return Math.max(minutes, MIN_READING_TIME_MINUTES);
}

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
