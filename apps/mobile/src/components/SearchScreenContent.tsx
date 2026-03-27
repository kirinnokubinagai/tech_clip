import { Search, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";

import { useDebounce } from "@/hooks/use-debounce";
import { useSearchArticles } from "@/hooks/use-search-articles";
import type { Article } from "@/types/article";

import { ArticleCard } from "./ArticleCard";

/** デバウンス遅延時間（ミリ秒） */
const DEBOUNCE_DELAY_MS = 400;

/** 検索アイコンサイズ */
const SEARCH_ICON_SIZE = 20;

/** クリアアイコンサイズ */
const CLEAR_ICON_SIZE = 18;

/** アイコン色 */
const ICON_COLOR = "#64748b";

/** プレースホルダーの色 */
const PLACEHOLDER_COLOR = "#64748b";

/**
 * 検索画面の表示コンテンツコンポーネント
 *
 * テキスト入力でデバウンス付き記事検索を行い、
 * 結果をArticleCardで表示する。無限スクロール対応。
 */
export function SearchScreenContent() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY_MS);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useSearchArticles(debouncedQuery);

  const articles = data?.pages.flatMap((page) => page.data) ?? [];

  const handleClear = useCallback(() => {
    setQuery("");
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(({ item }: { item: Article }) => {
    return (
      <View className="px-4 py-1.5">
        <ArticleCard article={item} />
      </View>
    );
  }, []);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) {
      return null;
    }
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" />
          <Text className="text-text-muted mt-4">検索中...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <Text className="text-error text-base">検索中にエラーが発生しました</Text>
          <Text className="text-text-muted mt-2 text-sm">もう一度お試しください</Text>
        </View>
      );
    }

    if (debouncedQuery.trim().length === 0) {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <Search size={48} color={ICON_COLOR} />
          <Text className="text-text-muted mt-4 text-base">キーワードを入力して記事を検索</Text>
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-text-muted text-base">検索結果が見つかりませんでした</Text>
      </View>
    );
  }, [isLoading, isError, debouncedQuery]);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center bg-surface border border-border rounded-lg px-3">
          <Search size={SEARCH_ICON_SIZE} color={ICON_COLOR} />
          <TextInput
            className="flex-1 text-text text-base py-3 px-2"
            placeholder="記事を検索..."
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={handleClear} accessibilityLabel="検索をクリア" hitSlop={8}>
              <X size={CLEAR_ICON_SIZE} color={ICON_COLOR} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={articles}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={articles.length === 0 ? { flexGrow: 1 } : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}
