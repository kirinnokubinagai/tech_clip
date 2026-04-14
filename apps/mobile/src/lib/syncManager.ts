import type { ArticleDetailResponse, ArticlesListResponse } from "@/types/article";

import { apiFetch } from "./api";
import {
  getOfflineTargetArticleIds,
  upsertArticle,
  upsertSummary,
  upsertTranslation,
} from "./localDb";

/** 最新記事を本文までオフライン保存する件数 */
const OFFLINE_FULL_CONTENT_LIMIT = 20;

/** 同期結果 */
export type SyncResult = {
  synced: number;
  errors: string[];
};

/** 記事詳細同期結果 */
export type SyncDetailResult = { success: true } | { success: false; error: string };

/** プレフェッチ結果 */
export type PrefetchResult = {
  prefetched: number;
  errors: string[];
};

/** オフライン同期全体の結果 */
export type SyncAllResult = {
  listSynced: number;
  contentsPrefetched: number;
  errors: string[];
};

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

/**
 * オフライン対象記事の本文を順次取得して保存する
 * - 直列実行（サーバー負荷とバックグラウンドフェッチ時間制限のため）
 * - 個別記事の失敗は errors に記録するが処理は継続する
 *
 * @param limit - 最新記事の取得件数
 * @returns プレフェッチ結果
 */
export async function prefetchOfflineArticleContents(
  limit = OFFLINE_FULL_CONTENT_LIMIT,
): Promise<PrefetchResult> {
  const ids = await getOfflineTargetArticleIds(limit);

  if (ids.length === 0) {
    return { prefetched: 0, errors: [] };
  }

  let prefetched = 0;
  const errors: string[] = [];

  for (const id of ids) {
    try {
      const result = await syncArticleDetail(id);
      if (result.success) {
        prefetched++;
      } else {
        errors.push(`${id}: ${result.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "不明なエラーが発生しました";
      errors.push(`${id}: ${message}`);
    }
  }

  return { prefetched, errors };
}

/**
 * バックグラウンド同期エントリポイント
 * 1. 一覧同期
 * 2. 本文プレフェッチ（最新 N 件 + お気に入り）
 *
 * @returns オフライン同期全体の結果
 */
export async function syncAllForOffline(): Promise<SyncAllResult> {
  const allErrors: string[] = [];
  let listSynced = 0;

  try {
    const listResult = await syncArticles();
    listSynced = listResult.synced;
    for (const error of listResult.errors) {
      allErrors.push(error);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "一覧同期中にエラーが発生しました";
    allErrors.push(message);
  }

  const prefetchResult = await prefetchOfflineArticleContents();
  for (const error of prefetchResult.errors) {
    allErrors.push(error);
  }

  return {
    listSynced,
    contentsPrefetched: prefetchResult.prefetched,
    errors: allErrors,
  };
}
