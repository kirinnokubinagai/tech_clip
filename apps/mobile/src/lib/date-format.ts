import type { Language } from "@/stores/settings-store";

/** localeコードから Intl.DateTimeFormat locale へのマッピング */
const INTL_LOCALE_MAP: Record<Language, string> = {
  ja: "ja-JP",
  en: "en-US",
};

/** デフォルトのlocale */
const DEFAULT_LOCALE: Language = "ja";

/** Intl.DateTimeFormat インスタンスのキャッシュ */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * intl locale に対応するフォーマッターを取得する
 * 同一 locale のインスタンスをキャッシュして再利用する
 *
 * @param intlLocale - Intl.DateTimeFormat に渡す locale 文字列
 * @returns キャッシュ済みの Intl.DateTimeFormat インスタンス
 */
function getFormatter(intlLocale: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(intlLocale);
  if (cached) {
    return cached;
  }
  const fmt = new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  formatterCache.set(intlLocale, fmt);
  return fmt;
}

/**
 * ISO 8601日付文字列をlocaleに応じた形式にフォーマットする
 *
 * @param isoString - ISO 8601形式の日付文字列
 * @param locale - 表示言語のlocaleコード（省略時は "ja"）
 * @returns フォーマットされた日付文字列。不正な日付の場合は空文字
 */
export function formatArticleDate(isoString: string, locale: Language = DEFAULT_LOCALE): string {
  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const intlLocale = INTL_LOCALE_MAP[locale];

  return getFormatter(intlLocale).format(date);
}
