import { useInfiniteQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { SearchArticlesResponse } from "@/types/article";

/** 検索クエリキーのプレフィックス */
export const SEARCH_QUERY_KEY_PREFIX = "search-articles";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 検索キーワード最小文字数 */
const QUERY_MIN_LENGTH = 1;

/**
 * 記事検索APIを呼び出す
 *
 * @param query - 検索キーワード
 * @param cursor - ページネーションカーソル
 * @param limit - 1ページあたりの取得件数
 * @returns 検索結果レスポンス
 */
export async function searchArticles(
  query: string,
  cursor?: string,
  limit: number = DEFAULT_LIMIT,
): Promise<SearchArticlesResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return apiFetch<SearchArticlesResponse>(`/api/articles/search?${params.toString()}`);
}

/**
 * 記事検索用のTanStack Queryフック
 *
 * デバウンス済みの検索キーワードを受け取り、無限スクロール対応で検索結果を返す。
 * キーワードが空の場合はクエリを無効化する。
 *
 * @param debouncedQuery - デバウンス済み検索キーワード
 * @returns TanStack Query の useInfiniteQuery 結果
 */
export function useSearchArticles(debouncedQuery: string) {
  return useInfiniteQuery({
    queryKey: [SEARCH_QUERY_KEY_PREFIX, debouncedQuery],
    queryFn: ({ pageParam }) => searchArticles(debouncedQuery, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: debouncedQuery.trim().length >= QUERY_MIN_LENGTH,
  });
}
