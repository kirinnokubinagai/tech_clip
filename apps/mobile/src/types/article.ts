<<<<<<< HEAD
export type Article = {
  id: string;
  userId: string;
  url: string;
  source: string;
  title: string;
  author: string | null;
  excerpt: string | null;
  thumbnailUrl: string | null;
  readingTimeMinutes: number | null;
  isRead: boolean;
  isFavorite: boolean;
  isPublic: boolean;
  publishedAt: string | null;
=======
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
export type SearchArticlesResponse = {
  success: true;
  data: Article[];
  meta: {
    nextCursor: string | null;
    hasNext: boolean;
  };
};

export type SearchArticlesErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
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
