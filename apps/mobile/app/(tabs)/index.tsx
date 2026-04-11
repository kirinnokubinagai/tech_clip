import { useRouter } from "expo-router";
import { Heart, RefreshCw } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { ArticleCard } from "@/components/ArticleCard";
import { useArticles, useToggleFavorite } from "@/hooks/use-articles";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useOfflineArticles } from "@/hooks/use-offline-articles";
import { DARK_COLORS } from "@/lib/constants";
import type { ArticleListItem, ArticleSource } from "@/types/article";

/** フィルターチップのアクティブ背景色 */
const FILTER_ACTIVE_BG = DARK_COLORS.primary;

/** フィルターチップの非アクティブ背景色 */
const FILTER_INACTIVE_BG = DARK_COLORS.card;

/** お気に入りフィルターのアクティブ色 */
const FAVORITE_ACTIVE_COLOR = DARK_COLORS.favorite;

/** お気に入りフィルターの非アクティブ色 */
const FAVORITE_INACTIVE_COLOR = DARK_COLORS.textMuted;

/** フィルターアイコンサイズ */
const FILTER_ICON_SIZE = 16;

/** ソースフィルターの選択肢（固有名詞はそのまま、「すべて」のみ翻訳） */
const SOURCE_FILTER_STATIC: {
  value: ArticleSource | undefined;
  staticLabel?: string;
  i18nKey?: string;
}[] = [
  { i18nKey: "home.filterAll", value: undefined },
  { staticLabel: "Zenn", value: "zenn" },
  { staticLabel: "Qiita", value: "qiita" },
  { staticLabel: "はてな", value: "hatena" },
  { staticLabel: "note", value: "note" },
  { staticLabel: "Dev.to", value: "devto" },
  { staticLabel: "Medium", value: "medium" },
  { staticLabel: "GitHub", value: "github" },
  { staticLabel: "HN", value: "hackernews" },
];

/**
 * ホーム画面
 *
 * 記事一覧をFlatListで表示する。ソースフィルター、お気に入りフィルター、
 * プルリフレッシュ、無限スクロールに対応。
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedSource, setSelectedSource] = useState<ArticleSource | undefined>(undefined);
  const [isFavoriteOnly, setIsFavoriteOnly] = useState(false);

  const { isOffline } = useNetworkStatus();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useArticles({
    source: selectedSource,
    isFavorite: isFavoriteOnly || undefined,
  });

  const { articles: offlineArticles, isLoading: isOfflineLoading } = useOfflineArticles();

  const toggleFavorite = useToggleFavorite();

  const onlineArticles = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const articles = useMemo(
    () => (isOffline ? offlineArticles : onlineArticles),
    [isOffline, offlineArticles, onlineArticles],
  );

  const sourceFilters = useMemo(
    () =>
      SOURCE_FILTER_STATIC.map((opt) => ({
        label: opt.i18nKey ? t(opt.i18nKey) : (opt.staticLabel ?? ""),
        value: opt.value,
      })),
    [t],
  );

  const handleArticlePress = useCallback(
    (articleId: string) => {
      router.push(`/article/${articleId}`);
    },
    [router],
  );

  const handleToggleFavorite = useCallback(
    (article: ArticleListItem) => {
      toggleFavorite.mutate({ articleId: article.id, isFavorite: article.isFavorite });
    },
    [toggleFavorite],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: ArticleListItem }) => (
      <View className="px-4 pb-3">
        <ArticleCard
          article={item}
          onPress={() => handleArticlePress(item.id)}
          onToggleFavorite={() => handleToggleFavorite(item)}
        />
      </View>
    ),
    [handleArticlePress, handleToggleFavorite],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={FILTER_ACTIVE_BG} />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading || isOfflineLoading) return null;
    if (isOffline) {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <Text className="text-text-muted text-base">{t("home.offlineNoCache")}</Text>
        </View>
      );
    }
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-text-muted text-base">
          {isError ? t("home.fetchError") : t("home.noArticles")}
        </Text>
        {isError && (
          <Pressable
            onPress={() => refetch()}
            className="mt-4 flex-row items-center gap-2"
            accessibilityRole="button"
            accessibilityLabel={t("home.retryLabel")}
            accessibilityHint={t("home.retryHint")}
          >
            <RefreshCw size={FILTER_ICON_SIZE} color={FILTER_ACTIVE_BG} />
            <Text className="text-primary">{t("common.retry")}</Text>
          </Pressable>
        )}
      </View>
    );
  }, [isLoading, isOfflineLoading, isOffline, isError, refetch, t]);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-2 pb-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={sourceFilters}
          keyExtractor={(item) => item.label}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedSource(item.value)}
              className="rounded-full px-3 py-1.5"
              style={{
                backgroundColor:
                  selectedSource === item.value ? FILTER_ACTIVE_BG : FILTER_INACTIVE_BG,
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityHint={t("home.sourceFilterHint", { label: item.label })}
              accessibilityState={{ selected: selectedSource === item.value }}
            >
              <Text
                className="text-sm"
                style={{
                  color: selectedSource === item.value ? DARK_COLORS.white : DARK_COLORS.textMuted,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
        <View className="flex-row items-center mt-2 gap-3">
          <Pressable
            onPress={() => setIsFavoriteOnly((prev) => !prev)}
            className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{
              backgroundColor: isFavoriteOnly ? DARK_COLORS.dangerSurface : FILTER_INACTIVE_BG,
            }}
            accessibilityRole="button"
            accessibilityLabel={
              isFavoriteOnly ? t("home.favoritesFilterClearLabel") : t("home.favoritesFilterLabel")
            }
          >
            <Heart
              size={FILTER_ICON_SIZE}
              color={isFavoriteOnly ? FAVORITE_ACTIVE_COLOR : FAVORITE_INACTIVE_COLOR}
              fill={isFavoriteOnly ? FAVORITE_ACTIVE_COLOR : "transparent"}
            />
            <Text
              className="text-sm"
              style={{ color: isFavoriteOnly ? FAVORITE_ACTIVE_COLOR : DARK_COLORS.textMuted }}
            >
              {t("home.favorites")}
            </Text>
          </Pressable>
        </View>
      </View>

      {isLoading || isOfflineLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={FILTER_ACTIVE_BG} />
          <Text className="text-text-muted mt-3">{t("home.loadingArticles")}</Text>
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={DARK_COLORS.primary}
            />
          }
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 20 }}
        />
      )}
    </View>
  );
}
