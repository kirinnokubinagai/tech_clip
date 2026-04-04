import { useEffect, useState } from "react";

import { getOfflineArticles } from "@/lib/localDb";
import type { ArticleListItem } from "@/types/article";

import { useNetworkStatus } from "./use-network-status";

/** オフライン記事フックの戻り値 */
type OfflineArticlesResult = {
  articles: ArticleListItem[];
  isLoading: boolean;
};

/**
 * オフライン時にローカルDBからキャッシュ済み記事を取得するフック
 *
 * オンライン時は空配列を返す。オフライン時のみlocalDbを参照する。
 *
 * @returns キャッシュ済み記事一覧とローディング状態
 */
export function useOfflineArticles(): OfflineArticlesResult {
  const { isOffline } = useNetworkStatus();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOffline) {
      setArticles([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    getOfflineArticles()
      .then((cached) => {
        setArticles(cached);
      })
      .catch(() => {
        setArticles([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOffline]);

  return { articles, isLoading };
}
