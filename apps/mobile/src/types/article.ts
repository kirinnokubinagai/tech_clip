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

export type ArticleDetail = {
  id: string;
  url: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  author: string | null;
  source: ArticleSource;
  thumbnailUrl: string | null;
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
