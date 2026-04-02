import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
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

/**
 * AI要約リクエストのmutation hook
 *
 * @returns TanStack QueryのuseMutation結果
 */
export function useRequestSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (articleId: string) => {
      const response = await apiFetch<{ success: boolean; data: { summary: string } }>(
        `/api/articles/${articleId}/summary`,
        { method: "POST" },
      );
      return response;
    },
    onSuccess: (_data, articleId) => {
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
    mutationFn: async (articleId: string) => {
      const response = await apiFetch<{ success: boolean; data: { translation: string } }>(
        `/api/articles/${articleId}/translate`,
        { method: "POST" },
      );
      return response;
    },
    onSuccess: (_data, articleId) => {
      queryClient.invalidateQueries({ queryKey: [ARTICLE_DETAIL_QUERY_KEY, articleId] });
    },
  });
}
