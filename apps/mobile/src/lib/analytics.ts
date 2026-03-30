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
 * アナリティクスイベントを記録する
 * バックエンドの /analytics/events エンドポイントが未実装のため、
 * 現時点では何も送信しない。実装時に復元すること。
 *
 * @param _event - イベント名
 * @param _properties - イベントプロパティ
 */
export async function trackEvent(
  _event: AnalyticsEventNameType,
  _properties: Record<string, unknown>,
): Promise<void> {
  /* TODO: バックエンドに /analytics/events ルートを実装したら送信処理を復元する */
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
