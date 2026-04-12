import { SUPPORTED_SOURCES } from "@/lib/sources";
import type { ArticleSource } from "@/types/article";

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

/** ライト/ダークテーマで共通に扱うカラートークンの型 */
type ThemeColors = {
  background: string;
  surface: string;
  card: string;
  border: string;
  primary: string;
  primaryLight: string;
  text: string;
  textMuted: string;
  textDim: string;
  white: string;
  info: string;
  dangerSurface: string;
  successSurface: string;
  accent: string;
  error: string;
  success: string;
  warning: string;
  favorite: string;
  neutral: string;
};

/**
 * ライト/ダーク共通で使う意味ベースのカラー
 *
 * ## アーキテクチャ
 * - SEMANTIC_COLORS（共有）→ LIGHT_COLORS（ライトテーマ）にスプレッド
 * - SEMANTIC_COLORS（共有）→ DARK_COLORS（ダークテーマ）にスプレッド
 * - error / success / warning / favorite / neutral / white はここで一元管理
 *
 * ## accent トークンについて
 * 現在 accent = "#14b8a6" は Primary と同値。
 * TODO(#855): Primary に一本化し accent トークンを削除する（docs/mobile-theme.md 移行タスク#2 参照）
 *
 * ## 新色を追加するルール
 * - 既存トークンでカバーできない意味的状態が新たに生まれたときのみ追加する
 * - グラデーション・ネオン・蛍光系カラーは禁止（AIっぽい印象を避けるため）
 * - 追加時は docs/mobile-theme.md にも記載すること
 */
const SEMANTIC_COLORS = {
  /**
   * アクセントカラー（Primary と同値）
   * @deprecated Primary に一本化予定。docs/mobile-theme.md 移行タスク#2 参照
   */
  accent: "#14b8a6",
  /** エラー色（危険操作・失敗状態） */
  error: "#ef4444",
  /** 成功色（完了・OK状態） */
  success: "#22c55e",
  /** 警告色（注意が必要な状態） */
  warning: "#f59e0b",
  /** お気に入りやいいねに使う赤色 */
  favorite: "#ef4444",
  /** テーマ共通で使う中立色 */
  neutral: "#44403c",
  /** テーマ共通で使う白色 */
  white: "#ffffff",
} as const;

/**
 * ライトテーマカラー定義
 * SEMANTIC_COLORS の共有セマンティック色 + ライト固有のレイアウト色で構成
 *
 * ## Primary カラーについて
 * primary = "#14b8a6"（Teal）をブランドメインカラーとして採用。
 * ダークテーマも同色に統一する予定。docs/mobile-theme.md 参照
 *
 * ## サーフェスカラーについて
 * background / surface / card / border はテーマ固有の値であり、
 * テーマ切替時に LIGHT_COLORS / DARK_COLORS を useColorScheme で動的に選択すること
 */
export const LIGHT_COLORS = {
  /** 背景色 */
  background: "#fafaf9",
  /** セクション背景色 */
  surface: "#ffffff",
  /** カード背景色 */
  card: "#ffffff",
  /** プライマリアクション色 */
  primary: "#14b8a6",
  /** プライマリの明色 */
  primaryLight: "#5eead4",
  /** テキスト色 */
  text: "#1c1917",
  /** 補助テキスト色 */
  textMuted: "#57534e",
  /** さらに弱い補助テキスト色 */
  textDim: "#78716c",
  /** 境界線色 */
  border: "#e7e5e4",
  /** 情報色 */
  info: "#3b82f6",
  /** 危険操作の背景色 */
  dangerSurface: "#fef2f2",
  /** 成功状態の背景色 */
  successSurface: "#f0fdf4",
  ...SEMANTIC_COLORS,
} as const satisfies ThemeColors;

/**
 * ダークテーマカラー定義
 * SEMANTIC_COLORS の共有セマンティック色 + ダーク固有のレイアウト色で構成
 *
 * ## Primary カラーについて
 * 現在 primary = "#6366f1"（Indigo）はライトテーマ（Teal #14b8a6）と色相が異なり、
 * ブランドが分裂している。
 * TODO(#855): "#14b8a6"（Teal）に統一する。docs/mobile-theme.md 移行タスク#1 参照
 */
export const DARK_COLORS = {
  /** アプリ全体の背景色 */
  background: "#0a0a0f",
  /** セクション背景色 */
  surface: "#13131a",
  /** カード背景色 */
  card: "#1a1a2e",
  /** 境界線色 */
  border: "#2d2d44",
  /**
   * プライマリアクション色
   * TODO(#855): "#14b8a6"（Teal）に変更してブランドカラーを統一する
   */
  primary: "#6366f1",
  /**
   * プライマリの明色
   * TODO(#855): primary 変更後は "#5eead4"（Teal-300）に合わせる
   */
  primaryLight: "#818cf8",
  /** 主要テキスト色 */
  text: "#e2e8f0",
  /** 補助テキスト色 */
  textMuted: "#94a3b8",
  /** さらに弱い補助テキスト色 */
  textDim: "#64748b",
  /** 情報色 */
  info: "#3b82f6",
  /** 危険操作の背景色 */
  dangerSurface: "#2d1a1a",
  /** 成功状態の背景色 */
  successSurface: "#1a2e1a",
  ...SEMANTIC_COLORS,
} as const satisfies ThemeColors;
