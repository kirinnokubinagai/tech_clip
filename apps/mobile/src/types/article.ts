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

export type ArticlePreview = {
  title: string;
  excerpt: string | null;
  author: string | null;
  source: ArticleSource;
  thumbnailUrl: string | null;
  readingTimeMinutes: number | null;
  publishedAt: string | null;
};

/** 記事一覧で使用するリスト表示用の型 */
export type ArticleListItem = {
  id: string;
  title: string;
  author: string | null;
  source: ArticleSource;
  publishedAt: string | null;
  excerpt: string | null;
  thumbnailUrl: string | null;
  isFavorite: boolean;
  url: string;
};

/** 記事詳細画面で使用する型 */
export type ArticleDetail = {
  id: string;
  title: string;
  author: string | null;
  source: ArticleSource;
  publishedAt: string | null;
  content: string | null;
  excerpt: string | null;
  thumbnailUrl: string | null;
  url: string;
  isFavorite: boolean;
  isRead: boolean;
  summary: string | null;
  translation: string | null;
  readingTimeMinutes: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedArticle = ArticlePreview & {
  id: string;
  url: string;
  content: string | null;
  userId: string;
  isRead: boolean;
  isFavorite: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 記事一覧APIレスポンス */
export type ArticlesListResponse =
  | {
      success: true;
      data: ArticleListItem[];
      meta: {
        nextCursor: string | null;
        hasNext: boolean;
      };
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

/** 記事詳細APIレスポンス */
export type ArticleDetailResponse =
  | {
      success: true;
      data: ArticleDetail;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

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
