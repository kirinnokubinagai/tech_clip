<<<<<<< HEAD
/** 記事のソース種別 */
=======
>>>>>>> origin/main
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

<<<<<<< HEAD
/** 記事データ（一覧用 - contentを含まない） */
export type ArticleListItem = {
  id: string;
  url: string;
=======
export type ArticlePreview = {
>>>>>>> origin/main
  title: string;
  excerpt: string | null;
  author: string | null;
  source: ArticleSource;
  thumbnailUrl: string | null;
  readingTimeMinutes: number | null;
<<<<<<< HEAD
  isRead: boolean;
  isFavorite: boolean;
  isPublic: boolean;
  publishedAt: string | null;
  savedBy: string;
=======
  publishedAt: string | null;
};

export type SavedArticle = ArticlePreview & {
  id: string;
  url: string;
  content: string | null;
  userId: string;
  isRead: boolean;
  isFavorite: boolean;
  isPublic: boolean;
>>>>>>> origin/main
  createdAt: string;
  updatedAt: string;
};

<<<<<<< HEAD
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
=======
export type ParseArticleResponse =
  | {
      success: true;
      data: ArticlePreview;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

export type SaveArticleResponse =
  | {
      success: true;
      data: SavedArticle;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };
>>>>>>> origin/main
