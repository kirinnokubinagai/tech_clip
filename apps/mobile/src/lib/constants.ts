import { SUPPORTED_SOURCES } from "@/lib/sources";
import type { ArticleSource } from "@/types/article";

/** ローカル開発用APIベースURL */
const DEFAULT_API_URL = "http://localhost:8787";

/**
 * APIのベースURLを取得する
 * Expo app.jsonのextra.apiUrlが設定されていればそれを使用し、
 * 未設定の場合はローカル開発用URLを返す
 *
 * @returns APIのベースURL
 */
export function getApiBaseUrl(): string {
  return DEFAULT_API_URL;
}

/** アプリのURLスキーム */
export const APP_SCHEME = "techclip";

/** 無料プランでのAI要約・翻訳の使用上限回数 */
export const MAX_FREE_AI_USES = 5;

/** 対応するすべての記事ソース */
export { SUPPORTED_SOURCES };

/** 対応するすべての記事ソース数（`other` を含む） */
export const SUPPORTED_SOURCE_COUNT = SUPPORTED_SOURCES.length;

export type { ArticleSource };

/** ページネーションのデフォルト取得件数 */
export const PAGINATION_LIMIT = 20;

/** TanStack Queryのstale判定時間（5分・ミリ秒） */
export const STALE_TIME_MS = 5 * 60 * 1000;

/** 画像サイズ定義 */
export const IMAGE_SIZES = {
  /** サムネイル画像 */
  thumbnail: { width: 120, height: 80 },
  /** アバター画像 */
  avatar: { width: 40, height: 40 },
  /** フルサイズ画像 */
  full: { width: 800, height: 600 },
} as const;

/** テーマカラー定義 */
export const THEME_COLORS = {
  /** 背景色 */
  background: "#fafaf9",
  /** カード背景色 */
  card: "#ffffff",
  /** テキスト色 */
  text: "#1c1917",
  /** アクセントカラー（プライマリ） */
  accent: "#14b8a6",
  /** 境界線色 */
  border: "#e7e5e4",
  /** エラー色 */
  error: "#ef4444",
  /** 成功色 */
  success: "#22c55e",
  /** 警告色 */
  warning: "#f59e0b",
} as const;
