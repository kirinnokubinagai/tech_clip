import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { upsertArticle, upsertSummary, upsertTranslation } from "@/lib/localDb";
import type {
  ArticleDetail,
  ArticleDetailResponse,
  ArticleListItem,
  ArticleSource,
  ArticlesListResponse,
} from "@/types/article";

/** 記事一覧のクエリキー */
const ARTICLES_QUERY_KEY = "articles";

/** 記事詳細のクエリキー */
const ARTICLE_DETAIL_QUERY_KEY = "article-detail";

/** ページネーションのデフォルト取得件数 */
const DEFAULT_PAGE_LIMIT = 20;

/** 検索デバウンス時間（ミリ秒） */
export const SEARCH_DEBOUNCE_MS = 300;

type AiJobState = "queued" | "running" | "completed" | "failed";

type SummaryJobStartResponse = {
  success: boolean;
  data: {
    status: AiJobState;
    progress: number;
    jobId: string | null;
    summary?: { summary: string };
    error?: string;
  };
};

type SummaryJobStatusResponse = {
  success: boolean;
  data: {
    status: AiJobState;
    progress: number;
    jobId: string;
    summary?: { summary: string };
    error?: string;
  };
};

type TranslationJobStartResponse = {
  success: boolean;
  data: {
    status: AiJobState;
    progress: number;
    jobId: string | null;
    translation?: { translatedContent: string };
    error?: string;
  };
};

type TranslationJobStatusResponse = {
  success: boolean;
  data: {
    status: AiJobState;
    progress: number;
    jobId: string;
    translation?: { translatedContent: string };
    error?: string;
  };
};

/** 記事一覧取得のフィルター条件 */
type ArticlesFilter = {
  source?: ArticleSource;
  isFavorite?: boolean;
};

/**
 * 記事一覧をAPIから取得する
 *
 * @param cursor - ページネーションカーソル
 * @param filter - フィルター条件
 * @returns 記事一覧データ
 */
async function fetchArticles(
  cursor: string | undefined,
  filter: ArticlesFilter,
): Promise<{ items: ArticleListItem[]; nextCursor: string | null; hasNext: boolean }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(DEFAULT_PAGE_LIMIT));
  if (filter.source) params.set("source", filter.source);
  if (filter.isFavorite) params.set("isFavorite", "true");

  const queryString = params.toString();
  const path = `/api/articles${queryString ? `?${queryString}` : ""}`;

  const response = await apiFetch<ArticlesListResponse>(path);

  if (!response.success) {
    throw new Error(response.error.message);
  }

  return {
    items: response.data,
    nextCursor: response.meta.nextCursor,
    hasNext: response.meta.hasNext,
  };
}

/**
 * 記事検索結果をAPIから取得する
 *
 * @param cursor - ページネーションカーソル
 * @param query - 検索クエリ
 * @returns 検索結果データ
 */
async function fetchSearchResults(
  cursor: string | undefined,
  query: string,
): Promise<{ items: ArticleListItem[]; nextCursor: string | null; hasNext: boolean }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(DEFAULT_PAGE_LIMIT));
  params.set("q", query);

  const queryString = params.toString();
  const path = `/api/articles/search?${queryString}`;

  const response = await apiFetch<ArticlesListResponse>(path);

  if (!response.success) {
    throw new Error(response.error.message);
  }

  return {
    items: response.data,
    nextCursor: response.meta.nextCursor,
    hasNext: response.meta.hasNext,
  };
}

/**
 * 記事詳細をAPIから取得する
 *
 * @param articleId - 記事ID
 * @returns 記事詳細データ
 */
async function fetchArticleDetail(articleId: string): Promise<ArticleDetail> {
  const response = await apiFetch<ArticleDetailResponse>(`/api/articles/${articleId}`);

  if (!response.success) {
    throw new Error(response.error.message);
  }

  await upsertArticle(response.data);
  if (response.data.summary !== null) {
    await upsertSummary(articleId, response.data.summary);
  }
  if (response.data.translation !== null) {
    await upsertTranslation(articleId, response.data.translation);
  }

  return response.data;
}

/**
 * 記事一覧を取得するhook（無限スクロール対応）
 *
 * @param filter - フィルター条件
 * @returns TanStack QueryのuseInfiniteQuery結果
 */
export function useArticles(filter: ArticlesFilter = {}) {
  return useInfiniteQuery({
    queryKey: [ARTICLES_QUERY_KEY, filter],
    queryFn: ({ pageParam }) => fetchArticles(pageParam as string | undefined, filter),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
  });
}

/**
 * 記事検索用hook（無限スクロール対応）
 *
 * @param query - 検索クエリ
 * @returns TanStack QueryのuseInfiniteQuery結果
 */
export function useSearchArticles(query: string) {
  return useInfiniteQuery({
    queryKey: [ARTICLES_QUERY_KEY, "search", query],
    queryFn: ({ pageParam }) => fetchSearchResults(pageParam as string | undefined, query),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
    enabled: query.length > 0,
  });
}

/**
 * 記事詳細を取得するhook
 *
 * @param articleId - 記事ID
 * @returns TanStack QueryのuseQuery結果
 */
export function useArticleDetail(articleId: string) {
  return useQuery({
    queryKey: [ARTICLE_DETAIL_QUERY_KEY, articleId],
    queryFn: () => fetchArticleDetail(articleId),
    enabled: !!articleId,
  });
}

/**
 * お気に入りトグルのmutation hook
 *
 * @returns TanStack QueryのuseMutation結果
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ articleId, isFavorite }: { articleId: string; isFavorite: boolean }) => {
      const response = await apiFetch<{ success: boolean }>(`/api/articles/${articleId}`, {
        method: "PATCH",
        body: JSON.stringify({ isFavorite: !isFavorite }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ARTICLES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ARTICLE_DETAIL_QUERY_KEY] });
    },
  });
}

/** 要約でサポートされる言語 */
type SummaryLanguage = "ja" | "en" | "zh" | "zh-CN" | "zh-TW" | "ko";

/** 翻訳でサポートされる言語 */
type TranslationLanguage = "en" | "ja" | "zh" | "zh-CN" | "zh-TW" | "ko";

/** 要約リクエストのパラメータ */
type RequestSummaryParams = {
  articleId: string;
  language: SummaryLanguage;
};

/** 翻訳リクエストのパラメータ */
type RequestTranslationParams = {
  articleId: string;
  targetLanguage: TranslationLanguage;
};

/**
 * AI要約リクエストのmutation hook
 *
 * @returns TanStack QueryのuseMutation結果
 */
export function useRequestSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ articleId, language }: RequestSummaryParams) => {
      const response = await apiFetch<SummaryJobStartResponse>(
        `/api/articles/${articleId}/summary`,
        { method: "POST", body: JSON.stringify({ language }) },
      );
      return response;
    },
    onSuccess: async (data, { articleId }) => {
      if (data.success && data.data.summary?.summary) {
        await upsertSummary(articleId, data.data.summary.summary);
      }
      queryClient.invalidateQueries({ queryKey: [ARTICLE_DETAIL_QUERY_KEY, articleId] });
    },
  });
}

/**
 * AI翻訳リクエストのmutation hook
 *
 * @returns TanStack QueryのuseMutation結果
 */
export function useRequestTranslation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ articleId, targetLanguage }: RequestTranslationParams) => {
      const response = await apiFetch<TranslationJobStartResponse>(
        `/api/articles/${articleId}/translate`,
        { method: "POST", body: JSON.stringify({ targetLanguage }) },
      );
      return response;
    },
    onSuccess: async (data, { articleId }) => {
      if (data.success && data.data.translation?.translatedContent) {
        await upsertTranslation(articleId, data.data.translation.translatedContent);
      }
      queryClient.invalidateQueries({ queryKey: [ARTICLE_DETAIL_QUERY_KEY, articleId] });
    },
  });
}

/**
 * AI要約ジョブのステータスをポーリングするmutation hook
 *
 * @returns TanStack QueryのuseMutation結果
 */
export function useSummaryJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ articleId, jobId }: { articleId: string; jobId: string }) => {
      return apiFetch<SummaryJobStatusResponse>(`/api/articles/${articleId}/summary/jobs/${jobId}`);
    },
    onSuccess: async (data, variables) => {
      if (data.success && data.data.summary?.summary) {
        await upsertSummary(variables.articleId, data.data.summary.summary);
      }
      if (data.success && data.data.status === "completed") {
        queryClient.invalidateQueries({
          queryKey: [ARTICLE_DETAIL_QUERY_KEY, variables.articleId],
        });
      }
    },
  });
}

/**
 * AI翻訳ジョブのステータスをポーリングするmutation hook
 *
 * @returns TanStack QueryのuseMutation結果
 */
export function useTranslationJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ articleId, jobId }: { articleId: string; jobId: string }) => {
      return apiFetch<TranslationJobStatusResponse>(
        `/api/articles/${articleId}/translate/jobs/${jobId}`,
      );
    },
    onSuccess: async (data, variables) => {
      if (data.success && data.data.translation?.translatedContent) {
        await upsertTranslation(variables.articleId, data.data.translation.translatedContent);
      }
      if (data.success && data.data.status === "completed") {
        queryClient.invalidateQueries({
          queryKey: [ARTICLE_DETAIL_QUERY_KEY, variables.articleId],
        });
      }
    },
  });
}
