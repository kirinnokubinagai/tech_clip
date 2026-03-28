import { useCallback } from "react";
import { FlatList, View } from "react-native";

import { ArticleCard, type ArticleCardArticle } from "./ArticleCard";
import { ArticleListSkeleton } from "./ui/skeletons";

type ArticleListProps = {
  articles: ArticleCardArticle[];
  onPressArticle: (article: ArticleCardArticle) => void;
  onToggleFavorite?: (article: ArticleCardArticle) => void;
  isLoading?: boolean;
};

/** リストアイテム間のスペース（px） */
const ITEM_SEPARATOR_HEIGHT = 12;

/**
 * アイテム間のセパレーター
 */
function ItemSeparator() {
  return <View style={{ height: ITEM_SEPARATOR_HEIGHT }} />;
}

/**
 * 記事一覧コンポーネント
 *
 * FlatListを使用した記事リスト。
 *
 * @param articles - 表示する記事データの配列
 * @param onPressArticle - 記事タップ時のコールバック
 * @param onToggleFavorite - お気に入りトグル時のコールバック
 * @param isLoading - ローディング状態
 */
export function ArticleList({
  articles,
  onPressArticle,
  onToggleFavorite,
  isLoading = false,
}: ArticleListProps) {
  const keyExtractor = useCallback((item: ArticleCardArticle) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: ArticleCardArticle }) => (
      <ArticleCard
        article={item}
        onPress={() => onPressArticle(item)}
        onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(item) : undefined}
      />
    ),
    [onPressArticle, onToggleFavorite],
  );

  if (isLoading) {
    return <ArticleListSkeleton />;
  }

  return (
    <FlatList
      data={articles}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparator}
      showsVerticalScrollIndicator={false}
    />
  );
}
