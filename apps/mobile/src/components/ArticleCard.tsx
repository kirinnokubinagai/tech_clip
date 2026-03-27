<<<<<<< HEAD
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Clock, ExternalLink, Heart } from "lucide-react-native";
import { Linking } from "react-native";
import { Pressable, Text, View } from "react-native";

import { Badge } from "@/components/ui";
import type { ArticleListItem } from "@/types/article";
import { SOURCE_LABELS } from "@/types/article";

/** サムネイル画像のぼかし強度 */
const THUMBNAIL_BLUR_HASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

/** 読了時間アイコンサイズ */
const ICON_SIZE_SM = 12;

/** アクションアイコンサイズ */
const ICON_SIZE_MD = 20;

/** お気に入りアイコンのアクティブ色 */
const FAVORITE_ACTIVE_COLOR = "#ef4444";

/** お気に入りアイコンの非アクティブ色 */
const FAVORITE_INACTIVE_COLOR = "#64748b";

/** 外部リンクアイコン色 */
const EXTERNAL_LINK_COLOR = "#94a3b8";

/** 読了時間テキスト色 */
const READING_TIME_COLOR = "#94a3b8";

/** サムネイル高さ */
const THUMBNAIL_HEIGHT = 160;

type ArticleCardProps = {
  article: ArticleListItem;
  onToggleFavorite: (articleId: string, isFavorite: boolean) => void;
};

/**
 * 日付文字列を相対表記に変換する
 *
 * @param dateStr - ISO8601形式の日付文字列
 * @returns 相対表記（例: "3日前", "2時間前"）
 */
function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) {
    return "";
  }

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return "たった今";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}分前`;
  }
  if (diffHours < 24) {
    return `${diffHours}時間前`;
  }
  if (diffDays < 30) {
    return `${diffDays}日前`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths}ヶ月前`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}年前`;
=======
import { Image } from "expo-image";
import { Heart } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Badge } from "@/components/ui";

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
const FAVORITE_ACTIVE_COLOR = "#ef4444";

/** お気に入り未設定のアイコンカラー */
const FAVORITE_INACTIVE_COLOR = "#94a3b8";

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
>>>>>>> origin/main
}

/**
 * 記事カードコンポーネント
 *
<<<<<<< HEAD
 * FlatListの各行に表示する記事カード。
 * サムネイル、タイトル、ソースバッジ、読了時間、お気に入りボタンを含む。
 *
 * @param article - 記事データ
 * @param onToggleFavorite - お気に入りトグルコールバック
 */
export function ArticleCard({ article, onToggleFavorite }: ArticleCardProps) {
  const sourceLabel = SOURCE_LABELS[article.source] ?? article.source;

  /**
   * 記事URLを外部ブラウザで開く
   */
  function handleOpenArticle() {
    Linking.openURL(article.url);
  }

  /**
   * お気に入りボタン押下時のハンドラ
   */
  function handleToggleFavorite() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleFavorite(article.id, !article.isFavorite);
  }

  return (
    <Pressable
      className="bg-card rounded-xl border border-border overflow-hidden mb-3"
      onPress={handleOpenArticle}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}を開く`}
    >
      {article.thumbnailUrl && (
        <Image
          source={{ uri: article.thumbnailUrl }}
          style={{ width: "100%", height: THUMBNAIL_HEIGHT }}
          placeholder={{ blurhash: THUMBNAIL_BLUR_HASH }}
          contentFit="cover"
          transition={200}
        />
      )}

      <View className="p-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Badge>{sourceLabel}</Badge>
          {article.readingTimeMinutes && (
            <View className="flex-row items-center gap-1">
              <Clock size={ICON_SIZE_SM} color={READING_TIME_COLOR} />
              <Text className="text-xs text-text-dim">{article.readingTimeMinutes}分</Text>
            </View>
          )}
          {article.publishedAt && (
            <Text className="text-xs text-text-dim">{formatRelativeDate(article.publishedAt)}</Text>
          )}
        </View>

        <Text className="text-text text-base font-semibold leading-snug mb-1" numberOfLines={2}>
          {article.title}
        </Text>

        {article.excerpt && (
          <Text className="text-text-muted text-sm leading-relaxed mb-3" numberOfLines={2}>
=======
 * 記事一覧で使用するカード型UIコンポーネント。
 * サムネイル、タイトル、ソースバッジ、著者、公開日、概要、お気に入りアイコンを表示する。
 *
 * @param article - 表示する記事データ
 * @param onPress - カードタップ時のコールバック
 * @param onToggleFavorite - お気に入りトグル時のコールバック
 */
export function ArticleCard({ article, onPress, onToggleFavorite }: ArticleCardProps) {
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
>>>>>>> origin/main
            {article.excerpt}
          </Text>
        )}

<<<<<<< HEAD
        {article.author && <Text className="text-text-dim text-xs mb-3">{article.author}</Text>}

        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={handleToggleFavorite}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={article.isFavorite ? "お気に入りを解除" : "お気に入りに追加"}
          >
            <Heart
              size={ICON_SIZE_MD}
              color={article.isFavorite ? FAVORITE_ACTIVE_COLOR : FAVORITE_INACTIVE_COLOR}
              fill={article.isFavorite ? FAVORITE_ACTIVE_COLOR : "none"}
            />
          </Pressable>

          <ExternalLink size={ICON_SIZE_MD} color={EXTERNAL_LINK_COLOR} />
        </View>
=======
        {onToggleFavorite && (
          <View className="flex-row justify-end pt-1">
            <Pressable
              testID="favorite-button"
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
>>>>>>> origin/main
      </View>
    </Pressable>
  );
}
