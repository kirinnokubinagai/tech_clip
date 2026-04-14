import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { ArticleCard } from "@/components/ArticleCard";
import { useColors } from "@/hooks/use-colors";
import { apiFetch } from "@/lib/api";
import type { ArticleListItem, ArticlesListResponse } from "@/types/article";

/** ページネーションのデフォルト取得件数 */
const DEFAULT_PAGE_LIMIT = 20;

/** 保存記事モード用クエリキー */
const SAVED_ARTICLES_QUERY_KEY = "profile-saved-articles";

/** 公開記事モード用クエリキー */
const PUBLIC_ARTICLES_QUERY_KEY = "profile-public-articles";

/** セパレーター高さ（px） */
const SEPARATOR_HEIGHT = 12;

type SavedMode = {
  mode: "saved";
  enabled: boolean;
};

type PublicMode = {
  mode: "public";
  userId: string;
};

/** ProfileArticlesSection のプロップス */
export type ProfileArticlesSectionProps = SavedMode | PublicMode;

/**
 * 保存記事を取得する
 */
async function fetchSavedArticles(
  cursor: string | undefined,
): Promise<{ items: ArticleListItem[]; nextCursor: string | null; hasNext: boolean }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(DEFAULT_PAGE_LIMIT));
  params.set("isFavorite", "true");

  const path = `/api/articles?${params.toString()}`;
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
 * 指定ユーザーの公開記事を取得する
 */
async function fetchPublicArticles(
  userId: string,
  cursor: string | undefined,
): Promise<{ items: ArticleListItem[]; nextCursor: string | null; hasNext: boolean }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(DEFAULT_PAGE_LIMIT));

  const path = `/api/users/${userId}/articles?${params.toString()}`;
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
 * アイテム間のセパレーター
 */
function ItemSeparator() {
  return <View style={{ height: SEPARATOR_HEIGHT }} />;
}

/**
 * プロフィール記事セクションコンポーネント
 *
 * saved モード: 自分の保存記事（isFavorite=true）を表示する
 * public モード: 指定ユーザーの公開記事を表示する
 *
 * @param props - セクションのプロップス
 */
export function ProfileArticlesSection(props: ProfileArticlesSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();

  const savedQuery = useInfiniteQuery({
    queryKey: [SAVED_ARTICLES_QUERY_KEY],
    queryFn: ({ pageParam }) => fetchSavedArticles(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
    enabled: props.mode === "saved" && props.enabled,
  });

  const publicQuery = useInfiniteQuery({
    queryKey: [PUBLIC_ARTICLES_QUERY_KEY, props.mode === "public" ? props.userId : ""],
    queryFn: ({ pageParam }) =>
      fetchPublicArticles(
        props.mode === "public" ? props.userId : "",
        pageParam as string | undefined,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
    enabled: props.mode === "public",
  });

  const query = props.mode === "saved" ? savedQuery : publicQuery;
  const emptyKey = props.mode === "saved" ? "profile.noSavedArticles" : "profile.noPublicArticles";
  const titleKey = props.mode === "saved" ? "profile.savedArticles" : "profile.publicArticles";
  const title = t(titleKey);

  const articles = query.data?.pages.flatMap((p) => p.items) ?? [];

  const handleLoadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query]);

  const handlePressArticle = useCallback(
    (article: ArticleListItem) => {
      router.push(`/article/${article.id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: ArticleListItem }) => (
      <ArticleCard article={item} onPress={() => handlePressArticle(item)} />
    ),
    [handlePressArticle],
  );

  const keyExtractor = useCallback((item: ArticleListItem) => item.id, []);

  return (
    <View testID="profile-articles-section" className="px-4 pt-4">
      <View className="border-t border-border pt-4">
        <Text className="text-base font-semibold text-text mb-3">{title}</Text>

        {query.isLoading && (
          <View testID="profile-articles-loading" className="items-center py-8">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {query.isError && (
          <View testID="profile-articles-error" className="items-center py-8">
            <Text className="text-text-muted text-sm text-center">{t("profile.fetchError")}</Text>
          </View>
        )}

        {!query.isLoading && !query.isError && articles.length === 0 && (
          <View testID="profile-articles-empty" className="items-center py-8">
            <Text className="text-text-muted text-sm text-center">{t(emptyKey)}</Text>
          </View>
        )}

        {!query.isLoading && !query.isError && articles.length > 0 && (
          <FlatList
            data={articles}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ItemSeparatorComponent={ItemSeparator}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
        )}
      </View>
    </View>
  );
}
