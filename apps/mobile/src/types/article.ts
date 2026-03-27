/** 記事のソース種別 */
export type ArticleSource =
  | "zenn"
  | "qiita"
  | "note"
  | "hatena"
  | "devto"
  | "medium"
  | "hackernews"
  | "hashnode"
  | "github"
  | "stackoverflow"
  | "reddit"
  | "speakerdeck"
  | "freecodecamp"
  | "logrocket"
  | "css-tricks"
  | "smashing"
  | "other";

/** 記事データ（一覧用 - contentを含まない） */
export type ArticleListItem = {
  id: string;
  url: string;
  title: string;
  excerpt: string | null;
  author: string | null;
  source: ArticleSource;
  thumbnailUrl: string | null;
  readingTimeMinutes: number | null;
  isRead: boolean;
  isFavorite: boolean;
  isPublic: boolean;
  publishedAt: string | null;
  savedBy: string;
  createdAt: string;
  updatedAt: string;
};

/** 記事一覧APIレスポンス */
export type ArticlesResponse = {
  success: true;
  data: ArticleListItem[];
  meta: {
    nextCursor: string | null;
    hasNext: boolean;
  };
};

/** 記事一覧APIエラーレスポンス */
export type ArticlesErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

/** ソースフィルターの選択肢 */
export type SourceFilterOption = {
  label: string;
  value: ArticleSource | null;
};

/** ソース表示名マッピング */
export const SOURCE_LABELS: Record<ArticleSource, string> = {
  zenn: "Zenn",
  qiita: "Qiita",
  note: "note",
  hatena: "Hatena",
  devto: "DEV",
  medium: "Medium",
  hackernews: "HN",
  hashnode: "Hashnode",
  github: "GitHub",
  stackoverflow: "SO",
  reddit: "Reddit",
  speakerdeck: "Speaker Deck",
  freecodecamp: "freeCodeCamp",
  logrocket: "LogRocket",
  "css-tricks": "CSS-Tricks",
  smashing: "Smashing",
  other: "Other",
};
