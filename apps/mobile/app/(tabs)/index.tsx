import { Heart } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { ArticleCard } from "../../src/components/ArticleCard";
import { ArticleCardSkeletonList } from "../../src/components/ArticleCardSkeleton";
import { SourceFilter } from "../../src/components/SourceFilter";
import { useArticles, useToggleFavorite } from "../../src/hooks/use-articles";
import type { ArticleListItem, ArticleSource } from "../../src/types/article";

/** お気に入りフィルターアイコンサイズ */
const FAVORITE_ICON_SIZE = 20;

/** お気に入りアクティブ色 */
const FAVORITE_ACTIVE_COLOR = "#ef4444";

/** お気に入り非アクティブ色 */
const FAVORITE_INACTIVE_COLOR = "#64748b";

/** FlatListのフッタースペーシング */
const LIST_FOOTER_HEIGHT = 80;

/** エラー再試行ボタン押下余白 */
const RETRY_BUTTON_HIT_SLOP = 8;

/**
 * ホーム画面コンポーネント
 *
 * 記事一覧をFlatListで表示し、ソースフィルターとお気に入りフィルターを提供する。
 * TanStack Queryによる無限スクロールとプルリフレッシュに対応。
 */
export default function HomeScreen() {
  const [sourceFilter, setSourceFilter] = useState<ArticleSource | null>(null);
  const [isFavoriteFilter, setIsFavoriteFilter] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useArticles(sourceFilter, isFavoriteFilter ? true : undefined);

  const toggleFavoriteMutation = useToggleFavorite();

  const articles = data?.pages.flatMap((page) => page.data) ?? [];

  /**
   * お気に入りトグルハンドラ
   */
  const handleToggleFavorite = useCallback(
    (articleId: string, isFavorite: boolean) => {
      toggleFavoriteMutation.mutate({ articleId, isFavorite });
    },
    [toggleFavoriteMutation],
  );

  /**
   * お気に入りフィルタートグルハンドラ
   */
  function handleToggleFavoriteFilter() {
    setIsFavoriteFilter((prev) => !prev);
  }

  /**
   * 記事カードをレンダリングする
   */
  const renderArticleCard = useCallback(
    ({ item }: { item: ArticleListItem }) => (
      <ArticleCard article={item} onToggleFavorite={handleToggleFavorite} />
    ),
    [handleToggleFavorite],
  );

  /**
   * FlatListのキー抽出関数
   */
  function keyExtractor(item: ArticleListItem) {
    return item.id;
  }

  /**
   * リスト末尾到達時の次ページ読み込み
   */
  function handleEndReached() {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }

  /**
   * リストヘッダー（フィルター群）
   */
  function renderListHeader() {
    return (
      <View>
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Text className="text-text text-lg font-bold">記事一覧</Text>
          <Pressable
            onPress={handleToggleFavoriteFilter}
            hitSlop={RETRY_BUTTON_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={
              isFavoriteFilter ? "お気に入りフィルターを解除" : "お気に入りのみ表示"
            }
          >
            <Heart
              size={FAVORITE_ICON_SIZE}
              color={isFavoriteFilter ? FAVORITE_ACTIVE_COLOR : FAVORITE_INACTIVE_COLOR}
              fill={isFavoriteFilter ? FAVORITE_ACTIVE_COLOR : "none"}
            />
          </Pressable>
        </View>
        <SourceFilter selected={sourceFilter} onSelect={setSourceFilter} />
      </View>
    );
  }

  /**
   * 空リスト時の表示
   */
  function renderEmptyComponent() {
    if (isLoading) {
      return <ArticleCardSkeletonList />;
    }

    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-text-muted text-base">
          {isFavoriteFilter ? "お気に入りの記事がありません" : "記事がありません"}
        </Text>
        <Text className="text-text-dim text-sm mt-2">記事を保存すると、ここに表示されます</Text>
      </View>
    );
  }

  /**
   * リスト末尾のローディング表示
   */
  function renderFooter() {
    if (isFetchingNextPage) {
      return <ArticleCardSkeletonList count={1} />;
    }
    return <View style={{ height: LIST_FOOTER_HEIGHT }} />;
  }

  if (isError) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-4">
        {renderListHeader()}
        <View className="flex-1 items-center justify-center">
          <Text className="text-error text-base mb-2">記事の読み込みに失敗しました</Text>
          <Text className="text-text-dim text-sm mb-4">
            {error?.message ?? "ネットワーク接続を確認してください"}
          </Text>
          <Pressable
            onPress={() => refetch()}
            className="bg-primary rounded-lg px-6 py-2"
            accessibilityRole="button"
            accessibilityLabel="再試行"
          >
            <Text className="text-white font-semibold">再試行</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={articles}
        renderItem={renderArticleCard}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyComponent}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => refetch()}
            tintColor="#6366f1"
          />
        }
      />
    </View>
  );
}
