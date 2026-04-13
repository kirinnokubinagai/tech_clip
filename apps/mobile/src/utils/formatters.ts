/** 1秒のミリ秒数 */
const SECOND_MS = 1000;

/** 1分のミリ秒数 */
const MINUTE_MS = 60 * SECOND_MS;

/** 1時間のミリ秒数 */
const HOUR_MS = 60 * MINUTE_MS;

/** 1日のミリ秒数 */
const DAY_MS = 24 * HOUR_MS;

/** 1週間のミリ秒数 */
const WEEK_MS = 7 * DAY_MS;

/** 1ヶ月のミリ秒数（約30日） */
const MONTH_MS = 30 * DAY_MS;

/** 1年のミリ秒数（約365日） */
const YEAR_MS = 365 * DAY_MS;

/** デフォルト省略記号 */
const DEFAULT_ELLIPSIS = "...";

/**
 * ユーザー名の頭文字を取得する
 *
 * @param name - ユーザー名
 * @returns 頭文字（最大2文字）
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** コンパクト数値の千の閾値 */
const THOUSAND = 1000;

/** コンパクト数値の百万の閾値 */
const MILLION = 1000000;

/**
 * 相対時間をフォーマットする（例: 「3時間前」）
 *
 * @param date - フォーマット対象の日時
 * @param now - 基準時刻（省略時は現在時刻）
 * @returns フォーマットされた相対時間文字列
 */
export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
  const targetDate = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - targetDate.getTime();

  if (diffMs < MINUTE_MS) {
    return "たった今";
  }

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return `${minutes}分前`;
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return `${hours}時間前`;
  }

  if (diffMs < WEEK_MS) {
    const days = Math.floor(diffMs / DAY_MS);
    return `${days}日前`;
  }

  if (diffMs < MONTH_MS) {
    const weeks = Math.floor(diffMs / WEEK_MS);
    return `${weeks}週間前`;
  }

  if (diffMs < YEAR_MS) {
    const months = Math.floor(diffMs / MONTH_MS);
    return `${months}ヶ月前`;
  }

  const years = Math.floor(diffMs / YEAR_MS);
  return `${years}年前`;
}

/**
 * テキストを指定文字数で切り詰める
 *
 * @param text - 切り詰め対象のテキスト
 * @param maxLength - 最大文字数
 * @param ellipsis - 省略記号（デフォルト: "..."）
 * @returns 切り詰められたテキスト
 */
export function truncateText(
  text: string,
  maxLength: number,
  ellipsis: string = DEFAULT_ELLIPSIS,
): string {
  if (text.length <= maxLength) {
    return text;
  }

  const keepLength = ellipsis === DEFAULT_ELLIPSIS ? maxLength : maxLength + 1;
  return text.slice(0, keepLength) + ellipsis;
}

/**
 * 数値をコンパクト形式にフォーマットする（例: 1200 → "1.2k"）
 *
 * @param num - フォーマット対象の数値
 * @returns フォーマットされた文字列
 */
export function formatCompactNumber(num: number): string {
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  if (absNum < THOUSAND) {
    return `${num}`;
  }

  const prefix = isNegative ? "-" : "";

  if (absNum < MILLION) {
    const value = absNum / THOUSAND;
    const rounded = Math.round(value * 10) / 10;
    if (rounded < THOUSAND) {
      const formatted = rounded % 1 === 0 ? `${rounded}` : `${rounded}`;
      return `${prefix}${formatted}k`;
    }
  }

  const value = absNum / MILLION;
  const rounded = Math.round(value * 10) / 10;
  const formatted = rounded % 1 === 0 ? `${rounded}` : `${rounded}`;
  return `${prefix}${formatted}M`;
}
