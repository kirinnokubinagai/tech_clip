import { useRouter } from "expo-router";
import { Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";

import { ArticleCard } from "@/components/ArticleCard";
import { SEARCH_DEBOUNCE_MS, useSearchArticles, useToggleFavorite } from "@/hooks/use-articles";
import { useColors } from "@/hooks/use-colors";
import type { ArticleListItem } from "@/types/article";

/** 検索アイコンサイズ */
const SEARCH_ICON_SIZE = 20;

/** クリアアイコンサイズ */
const CLEAR_ICON_SIZE = 18;

/**
 * 検索画面
 *
 * テキスト入力で記事を検索する。デバウンス付き。
 * 検索結果はArticleCardで表示し、無限スクロールに対応。
 */
export default function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();
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
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage, colors.primary]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    if (!debouncedQuery) {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <Search size={48} color={colors.border} />
          <Text className="text-text-muted text-base mt-4">{t("search.hint")}</Text>
          <Text className="text-text-dim text-sm mt-1">{t("search.hintSub")}</Text>
        </View>
      );
    }
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-text-muted text-base">
          {isError ? t("search.error") : t("article.noMatch", { query: debouncedQuery })}
        </Text>
        {isError && (
          <Pressable onPress={() => refetch()} className="mt-4">
            <Text className="text-primary">{t("common.retry")}</Text>
          </Pressable>
        )}
      </View>
    );
  }, [isLoading, debouncedQuery, isError, refetch, colors.border, t]);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center bg-card rounded-xl border border-border px-3 py-2 gap-2">
          <Search size={SEARCH_ICON_SIZE} color={colors.textDim} />
          <TextInput
            ref={inputRef}
            className="flex-1 text-text text-base py-1"
            placeholder={t("search.placeholder")}
            placeholderTextColor={colors.textDim}
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
              accessibilityLabel={t("search.clearLabel")}
              hitSlop={8}
            >
              <X size={CLEAR_ICON_SIZE} color={colors.textDim} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading && debouncedQuery ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-text-muted mt-3">{t("search.searching")}</Text>
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
