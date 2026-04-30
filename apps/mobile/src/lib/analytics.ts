import { apiFetch } from "./api";

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

/** アナリティクスAPIのパス */
const ANALYTICS_EVENTS_PATH = "/api/analytics/events";

/**
 * アナリティクスイベントを記録する
 * バックエンドの /api/analytics/events エンドポイントにイベントを送信する。
 * 送信失敗時はエラーを無視して継続する（アナリティクスはベストエフォート）。
 *
 * @param event - イベント名
 * @param properties - イベントプロパティ
 */
export async function trackEvent(
  event: AnalyticsEventNameType,
  properties: Record<string, unknown>,
): Promise<void> {
  try {
    await apiFetch(ANALYTICS_EVENTS_PATH, {
      method: "POST",
      body: JSON.stringify({ event, properties }),
    });
  } catch {
    // アナリティクス送信失敗はサイレントに無視する
  }
}

/**
 * 画面表示イベントを記録する
 *
 * @param screen - 画面名
 */
export async function trackScreenView(screen: string): Promise<void> {
  await trackEvent(AnalyticsEventName.SCREEN_VIEW, { screen });
}

/**
 * 記事閲覧イベントを記録する
 *
 * @param articleId - 記事ID
 */
export async function trackArticleView(articleId: string): Promise<void> {
  await trackEvent(AnalyticsEventName.ARTICLE_VIEW, { articleId });
}

/**
 * 記事保存イベントを記録する
 *
 * @param articleId - 記事ID
 */
export async function trackArticleSave(articleId: string): Promise<void> {
  await trackEvent(AnalyticsEventName.ARTICLE_SAVE, { articleId });
}

/**
 * 記事シェアイベントを記録する
 *
 * @param articleId - 記事ID
 */
export async function trackArticleShare(articleId: string): Promise<void> {
  await trackEvent(AnalyticsEventName.ARTICLE_SHARE, { articleId });
}

/**
 * AI要約リクエストイベントを記録する
 *
 * @param articleId - 記事ID
 */
export async function trackAiSummaryRequest(articleId: string): Promise<void> {
  await trackEvent(AnalyticsEventName.AI_SUMMARY_REQUEST, { articleId });
}

/**
 * 検索イベントを記録する
 *
 * @param query - 検索クエリ
 */
export async function trackSearch(query: string): Promise<void> {
  await trackEvent(AnalyticsEventName.SEARCH, { query });
}
