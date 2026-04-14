import { Image } from "expo-image";
import { Heart } from "lucide-react-native";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { SourceBadge } from "@/components/ui";
import { useColors } from "@/hooks/use-colors";
import { formatArticleDate } from "@/lib/date-format";
import { useSettingsStore } from "@/stores/settings-store";
import type { ArticleListItem } from "@/types/article";

/** ArticleCardに渡す記事データ */
export type ArticleCardArticle = Pick<
  ArticleListItem,
  "id" | "title" | "author" | "source" | "publishedAt" | "excerpt" | "thumbnailUrl" | "isFavorite"
>;

type ArticleCardProps = {
  article: ArticleCardArticle;
  onPress: () => void;
  onToggleFavorite?: () => void;
};

/** サムネイル画像の高さ（px） */
const THUMBNAIL_HEIGHT = 160;

/** お気に入りアイコンのサイズ（px） */
const FAVORITE_ICON_SIZE = 20;

/**
 * 記事カードコンポーネント
 *
 * 記事一覧で使用するカード型UIコンポーネント。
 * サムネイル、タイトル、ソースバッジ、著者、公開日、概要、お気に入りアイコンを表示する。
 * React.memoでラップし、propsが変化しない限り再レンダリングを防ぐ。
 *
 * @param article - 表示する記事データ
 * @param onPress - カードタップ時のコールバック
 * @param onToggleFavorite - お気に入りトグル時のコールバック
 */
export const ArticleCard = memo(function ArticleCard({
  article,
  onPress,
  onToggleFavorite,
}: ArticleCardProps) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const colors = useColors();

  return (
    <Pressable
      testID="article-card"
      className="bg-card rounded-xl border border-border overflow-hidden"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={article.title}
    >
      {article.thumbnailUrl && (
        <Image
          testID="article-thumbnail"
          source={{ uri: article.thumbnailUrl }}
          style={{ width: "100%", height: THUMBNAIL_HEIGHT }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      )}

      <View className="p-4 gap-2">
        <View className="flex-row items-center justify-between">
          <SourceBadge source={article.source} />
          {article.publishedAt && (
            <Text className="text-xs text-text-muted">
              {formatArticleDate(article.publishedAt, language)}
            </Text>
          )}
        </View>

        <Text className="text-base font-semibold text-text" numberOfLines={2}>
          {article.title}
        </Text>

        {article.author && <Text className="text-sm text-text-muted">{article.author}</Text>}

        {article.excerpt && (
          <Text className="text-sm text-text-muted" numberOfLines={3}>
            {article.excerpt}
          </Text>
        )}

        {onToggleFavorite && (
          <View className="flex-row justify-end pt-1">
            <Pressable
              testID="favorite-button"
              nativeID="favorite-button"
              onPress={(e) => {
                e?.stopPropagation();
                onToggleFavorite();
              }}
              accessibilityRole="button"
              accessibilityLabel={
                article.isFavorite ? t("article.removeFromFavorites") : t("article.addToFavorites")
              }
              hitSlop={8}
            >
              {article.isFavorite ? (
                <Heart
                  testID="favorite-icon-filled"
                  size={FAVORITE_ICON_SIZE}
                  color={colors.favorite}
                  fill={colors.favorite}
                />
              ) : (
                <Heart
                  testID="favorite-icon-outline"
                  size={FAVORITE_ICON_SIZE}
                  color={colors.textMuted}
                />
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
});
