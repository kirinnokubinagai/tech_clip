import type { ArticleDetailResponse, ArticlesListResponse } from "@/types/article";

import { apiFetch } from "./api";
import { upsertArticle, upsertSummary, upsertTranslation } from "./localDb";

/** 同期結果 */
export type SyncResult = {
  synced: number;
  errors: string[];
};

/** 記事詳細同期結果 */
export type SyncDetailResult = { success: true } | { success: false; error: string };

/**
 * サーバーから記事一覧を取得してローカルDBに同期する（全ページ取得）
 *
 * @returns 同期した記事数とエラー一覧
 */
export async function syncArticles(): Promise<SyncResult> {
  try {
    let synced = 0;
    let cursor: string | undefined;

    do {
      const url: string = cursor ? `/api/articles?cursor=${cursor}` : "/api/articles";
      const response = await apiFetch<ArticlesListResponse>(url, {
        method: "GET",
      });

      if (!response.success) {
        return {
          synced,
          errors: [response.error.message],
        };
      }

      for (const article of response.data) {
        await upsertArticle(article);
      }

      synced += response.data.length;
      cursor =
        response.meta.hasNext && response.meta.nextCursor != null
          ? response.meta.nextCursor
          : undefined;
    } while (cursor !== undefined);

    return {
      synced,
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "同期中にエラーが発生しました";
    return {
      synced: 0,
      errors: [message],
    };
  }
}

/**
 * 指定記事の詳細をサーバーから取得してローカルDBに同期する
 *
 * @param articleId - 同期する記事ID
 * @returns 同期成否
 */
export async function syncArticleDetail(articleId: string): Promise<SyncDetailResult> {
  try {
    const response = await apiFetch<ArticleDetailResponse>(`/api/articles/${articleId}`, {
      method: "GET",
    });

    if (!response.success) {
      return { success: false, error: response.error.message };
    }

    const detail = response.data;
    await upsertArticle(detail);

    if (detail.summary !== null) {
      await upsertSummary(articleId, detail.summary);
    }

    if (detail.translation !== null) {
      await upsertTranslation(articleId, detail.translation);
    }

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "記事詳細の同期中にエラーが発生しました";
    return { success: false, error: message };
  }
}
