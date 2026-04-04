import { useRouter } from "expo-router";
import { Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";

import { ArticleCard } from "@/components/ArticleCard";
import { SEARCH_DEBOUNCE_MS, useSearchArticles, useToggleFavorite } from "@/hooks/use-articles";
import { UI_COLORS } from "@/lib/constants";
import type { ArticleListItem } from "@/types/article";

/** 検索アイコンサイズ */
const SEARCH_ICON_SIZE = 20;

/** クリアアイコンサイズ */
const CLEAR_ICON_SIZE = 18;

/** プライマリカラー */
const PRIMARY_COLOR = UI_COLORS.primary;

/** 検索アイコンカラー */
const SEARCH_ICON_COLOR = UI_COLORS.textDim;

/**
 * 検索画面
 *
 * テキスト入力で記事を検索する。デバウンス付き。
 * 検索結果はArticleCardで表示し、無限スクロールに対応。
 */
export default function SearchScreen() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useSearchArticles(debouncedQuery);

  const toggleFavorite = useToggleFavorite();

  const articles = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputValue]);

  const handleClear = useCallback(() => {
    setInputValue("");
    setDebouncedQuery("");
    inputRef.current?.focus();
  }, []);

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
        <ActivityIndicator size="small" color={PRIMARY_COLOR} />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    if (!debouncedQuery) {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <Search size={48} color={UI_COLORS.border} />
          <Text className="text-text-muted text-base mt-4">キーワードで記事を検索</Text>
          <Text className="text-text-dim text-sm mt-1">タイトルや内容から検索できます</Text>
        </View>
      );
    }
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-text-muted text-base">
          {isError ? "検索に失敗しました" : `「${debouncedQuery}」に一致する記事がありません`}
        </Text>
        {isError && (
          <Pressable onPress={() => refetch()} className="mt-4">
            <Text className="text-primary">再試行</Text>
          </Pressable>
        )}
      </View>
    );
  }, [isLoading, debouncedQuery, isError, refetch]);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center bg-card rounded-xl border border-border px-3 py-2 gap-2">
          <Search size={SEARCH_ICON_SIZE} color={SEARCH_ICON_COLOR} />
          <TextInput
            ref={inputRef}
            className="flex-1 text-text text-base py-1"
            placeholder="記事を検索..."
            placeholderTextColor={UI_COLORS.textDim}
            value={inputValue}
            onChangeText={setInputValue}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {inputValue.length > 0 && (
            <Pressable
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="検索をクリア"
              hitSlop={8}
            >
              <X size={CLEAR_ICON_SIZE} color={SEARCH_ICON_COLOR} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading && debouncedQuery ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text className="text-text-muted mt-3">検索中...</Text>
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
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}
