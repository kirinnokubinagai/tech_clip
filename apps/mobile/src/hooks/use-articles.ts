import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { ArticleListItem, ArticlesErrorResponse, ArticlesResponse } from "@/types/article";

/** 記事一覧のクエリキー */
const ARTICLES_QUERY_KEY = "articles";

/** デフォルトのページサイズ */
const DEFAULT_PAGE_SIZE = 20;

/** 記事一覧取得パラメータ */
type FetchArticlesParams = {
  cursor?: string;
  source?: string | null;
  isFavorite?: boolean;
};

/**
 * 記事一覧APIを呼び出す
 *
 * @param params - フィルタ・ページネーションパラメータ
 * @returns 記事一覧レスポンス
 */
async function fetchArticles(params: FetchArticlesParams): Promise<ArticlesResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(DEFAULT_PAGE_SIZE));

  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }
  if (params.source) {
    searchParams.set("source", params.source);
  }
  if (params.isFavorite !== undefined) {
    searchParams.set("isFavorite", String(params.isFavorite));
  }

  const queryString = searchParams.toString();
  const path = `/articles?${queryString}`;

  const data = await apiFetch<ArticlesResponse | ArticlesErrorResponse>(path);

  if (!data.success) {
    throw new Error(data.error.message);
  }

  return data;
}

/**
 * 記事のお気に入り状態をトグルする
 *
 * @param articleId - 記事ID
 * @param isFavorite - 新しいお気に入り状態
 * @returns 更新後の記事データ
 */
async function toggleFavorite(
  articleId: string,
  isFavorite: boolean,
): Promise<{ success: true; data: ArticleListItem }> {
  const data = await apiFetch<{ success: true; data: ArticleListItem } | ArticlesErrorResponse>(
    `/articles/${articleId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ isFavorite }),
    },
  );

  if (!data.success) {
    throw new Error(data.error.message);
  }

  return data;
}

/**
 * 記事一覧をTanStack Queryで取得するカスタムフック
 *
 * @param source - ソースフィルター（nullの場合はフィルターなし）
 * @param isFavorite - お気に入りフィルター（undefinedの場合はフィルターなし）
 * @returns TanStack Queryのinfinite queryレスポンス
 */
export function useArticles(source?: string | null, isFavorite?: boolean) {
  return useInfiniteQuery({
    queryKey: [ARTICLES_QUERY_KEY, { source, isFavorite }],
    queryFn: ({ pageParam }) =>
      fetchArticles({
        cursor: pageParam as string | undefined,
        source,
        isFavorite,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNext ? lastPage.meta.nextCursor : undefined),
  });
}

/**
 * 記事のお気に入りトグル用ミューテーションフック
 *
 * @returns TanStack Queryのmutationレスポンス
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ articleId, isFavorite }: { articleId: string; isFavorite: boolean }) =>
      toggleFavorite(articleId, isFavorite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ARTICLES_QUERY_KEY] });
    },
  });
}
