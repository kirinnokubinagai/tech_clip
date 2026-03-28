import Constants from "expo-constants";

/** アナリティクスイベントAPIのパス */
const ANALYTICS_EVENTS_PATH = "/analytics/events";

/** APIリクエストのタイムアウト（ミリ秒） */
const ANALYTICS_REQUEST_TIMEOUT_MS = 5000;

/**
 * アナリティクスイベント名の定数
 */
export const AnalyticsEventName = {
  /** 画面表示 */
  SCREEN_VIEW: "screen_view",
  /** 記事閲覧 */
  ARTICLE_VIEW: "article_view",
  /** 記事保存 */
  ARTICLE_SAVE: "article_save",
  /** 記事シェア */
  ARTICLE_SHARE: "article_share",
  /** AI要約リクエスト */
  AI_SUMMARY_REQUEST: "ai_summary_request",
  /** 検索 */
  SEARCH: "search",
} as const;

/** アナリティクスイベント名の型 */
export type AnalyticsEventNameType = (typeof AnalyticsEventName)[keyof typeof AnalyticsEventName];

/**
 * アナリティクスイベントのペイロード型
 */
type AnalyticsPayload = {
  event: AnalyticsEventNameType;
  properties: Record<string, unknown>;
  timestamp: number;
};

/**
 * APIのベースURLを取得する
 *
 * @returns Workers APIのベースURL
 */
function getBaseUrl(): string {
  const extra = Constants.expoConfig?.extra;
  if (extra && typeof extra === "object" && "apiUrl" in extra) {
    return extra.apiUrl as string;
  }
  return "http://localhost:8787";
}

/**
 * アナリティクスイベントをAPIに送信する
 * ネットワークエラーやAPIエラーは静かに無視する（アナリティクスでアプリを止めない）
 *
 * @param event - イベント名
 * @param properties - イベントプロパティ
 */
export async function trackEvent(
  event: AnalyticsEventNameType,
  properties: Record<string, unknown>,
): Promise<void> {
  const payload: AnalyticsPayload = {
    event,
    properties,
    timestamp: Date.now(),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYTICS_REQUEST_TIMEOUT_MS);

  try {
    await fetch(`${getBaseUrl()}${ANALYTICS_EVENTS_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    /* アナリティクスのエラーはアプリの動作に影響させない */
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 画面表示イベントを送信する
 *
 * @param screen - 画面名
 */
export async function trackScreenView(screen: string): Promise<void> {
  await trackEvent(AnalyticsEventName.SCREEN_VIEW, { screen });
}

/**
 * 記事閲覧イベントを送信する
 *
 * @param articleId - 記事ID
 */
export async function trackArticleView(articleId: string): Promise<void> {
  await trackEvent(AnalyticsEventName.ARTICLE_VIEW, { articleId });
}

/**
 * 記事保存イベントを送信する
 *
 * @param articleId - 記事ID
 */
export async function trackArticleSave(articleId: string): Promise<void> {
  await trackEvent(AnalyticsEventName.ARTICLE_SAVE, { articleId });
}

/**
 * 記事シェアイベントを送信する
 *
 * @param articleId - 記事ID
 */
export async function trackArticleShare(articleId: string): Promise<void> {
  await trackEvent(AnalyticsEventName.ARTICLE_SHARE, { articleId });
}

/**
 * AI要約リクエストイベントを送信する
 *
 * @param articleId - 記事ID
 */
export async function trackAiSummaryRequest(articleId: string): Promise<void> {
  await trackEvent(AnalyticsEventName.AI_SUMMARY_REQUEST, { articleId });
}

/**
 * 検索イベントを送信する
 *
 * @param query - 検索クエリ
 */
export async function trackSearch(query: string): Promise<void> {
  await trackEvent(AnalyticsEventName.SEARCH, { query });
}
