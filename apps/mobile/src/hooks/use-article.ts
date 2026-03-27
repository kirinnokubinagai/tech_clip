import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { ArticleDetail } from "@/types/article";

/** 記事詳細キャッシュキーのプレフィックス */
const ARTICLE_QUERY_KEY_PREFIX = "article";

type ArticleSuccessResponse = {
  success: true;
  data: ArticleDetail;
};

type ArticleErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type ArticleApiResponse = ArticleSuccessResponse | ArticleErrorResponse;

/**
 * 記事IDからキャッシュキーを生成する
 *
 * @param articleId - 記事ID
 * @returns React Queryのキャッシュキー
 */
export function articleQueryKey(articleId: string) {
  return [ARTICLE_QUERY_KEY_PREFIX, articleId] as const;
}

/**
 * 記事詳細をAPIから取得する
 *
 * @param articleId - 記事ID
 * @returns 記事詳細データ
 * @throws Error - APIエラー時
 */
async function fetchArticle(articleId: string): Promise<ArticleDetail> {
  const data = await apiFetch<ArticleApiResponse>(`/articles/${articleId}`);

  if (!data.success) {
    throw new Error(data.error.message);
  }

  return data.data;
}

/**
 * 記事詳細を取得するReact Queryフック
 *
 * @param articleId - 記事ID
 * @returns クエリ結果（data, isLoading, error等）
 */
export function useArticle(articleId: string) {
  return useQuery({
    queryKey: articleQueryKey(articleId),
    queryFn: () => fetchArticle(articleId),
    enabled: !!articleId,
  });
}
