import { Image } from "expo-image";
import { Heart } from "lucide-react-native";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { Badge } from "@/components/ui";
import { UI_COLORS } from "@/lib/constants";

/** 記事ソースの型定義 */
type ArticleSource =
  | "zenn"
  | "qiita"
  | "note"
  | "hatena"
  | "devto"
  | "medium"
  | "hackernews"
  | "hashnode"
  | "github"
  | "stackoverflow"
  | "reddit"
  | "speakerdeck"
  | "freecodecamp"
  | "logrocket"
  | "css-tricks"
  | "smashing"
  | "other";

/** ArticleCardに渡す記事データ */
export type ArticleCardArticle = {
  id: string;
  title: string;
  author: string | null;
  source: ArticleSource;
  publishedAt: string | null;
  excerpt: string | null;
  thumbnailUrl: string | null;
  isFavorite: boolean;
};

type ArticleCardProps = {
  article: ArticleCardArticle;
  onPress: () => void;
  onToggleFavorite?: () => void;
};

/** サムネイル画像の高さ（px） */
const THUMBNAIL_HEIGHT = 160;

/** お気に入りアイコンのサイズ（px） */
const FAVORITE_ICON_SIZE = 20;

/** お気に入り済みのアイコンカラー */
const FAVORITE_ACTIVE_COLOR = UI_COLORS.error;

/** お気に入り未設定のアイコンカラー */
const FAVORITE_INACTIVE_COLOR = UI_COLORS.textMuted;

/**
 * 日付文字列をYYYY/MM/DD形式にフォーマットする
 *
 * @param isoString - ISO 8601形式の日付文字列
 * @returns フォーマットされた日付文字列
 */
function formatPublishedDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

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
          <Badge>{article.source}</Badge>
          {article.publishedAt && (
            <Text className="text-xs text-text-muted">
              {formatPublishedDate(article.publishedAt)}
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
              onPress={onToggleFavorite}
              accessibilityRole="button"
              accessibilityLabel={article.isFavorite ? "お気に入り解除" : "お気に入り追加"}
              hitSlop={8}
            >
              {article.isFavorite ? (
                <Heart
                  testID="favorite-icon-filled"
                  size={FAVORITE_ICON_SIZE}
                  color={FAVORITE_ACTIVE_COLOR}
                  fill={FAVORITE_ACTIVE_COLOR}
                />
              ) : (
                <Heart
                  testID="favorite-icon-outline"
                  size={FAVORITE_ICON_SIZE}
                  color={FAVORITE_INACTIVE_COLOR}
                />
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
});
