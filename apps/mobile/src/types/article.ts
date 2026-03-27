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
  createdAt: string;
  updatedAt: string;
};

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
