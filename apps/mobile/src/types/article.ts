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
export type ArticleDetail = {
  id: string;
  url: string;
  title: string;
  content: string | null;
=======
export type ArticlePreview = {
  title: string;
>>>>>>> origin/main
  excerpt: string | null;
  author: string | null;
  source: ArticleSource;
  thumbnailUrl: string | null;
<<<<<<< HEAD
  publishedAt: string | null;
  savedBy: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  summary: ArticleSummary | null;
  translation: ArticleTranslation | null;
};

export type ArticleSummary = {
  id: string;
  articleId: string;
  language: "ja" | "en";
  summary: string;
  model: string;
  createdAt: string;
};

export type ArticleTranslation = {
  id: string;
  articleId: string;
  targetLanguage: string;
  translatedTitle: string;
  translatedContent: string;
  model: string;
  createdAt: string;
};
=======
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
  createdAt: string;
  updatedAt: string;
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
>>>>>>> origin/main
