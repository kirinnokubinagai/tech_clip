import { ExternalLink, FileText, Heart, Languages } from "lucide-react-native";
import { Linking, Pressable, Text, View } from "react-native";

type ArticleActionBarProps = {
  articleUrl: string;
  isFavorite: boolean;
  hasSummary: boolean;
  hasTranslation: boolean;
  onToggleFavorite: () => void;
  onRequestSummary: () => void;
  onRequestTranslation: () => void;
};

/** アクションアイコンのサイズ */
const ACTION_ICON_SIZE = 20;

/** テーマカラー定数 */
const COLORS = {
  favorite: "#ef4444",
  inactive: "#94a3b8",
  primary: "#6366f1",
} as const;

/**
 * 記事詳細画面のアクションバーコンポーネント
 * お気に入りトグル、要約、翻訳、外部リンクのボタンを表示する
 *
 * @param articleUrl - 記事の元URL
 * @param isFavorite - お気に入り状態
 * @param hasSummary - 要約が存在するか
 * @param hasTranslation - 翻訳が存在するか
 * @param onToggleFavorite - お気に入りトグルコールバック
 * @param onRequestSummary - 要約リクエストコールバック
 * @param onRequestTranslation - 翻訳リクエストコールバック
 */
export function ArticleActionBar({
  articleUrl,
  isFavorite,
  hasSummary,
  hasTranslation,
  onToggleFavorite,
  onRequestSummary,
  onRequestTranslation,
}: ArticleActionBarProps) {
  return (
    <View className="flex-row items-center justify-around py-3 border-y border-border my-4">
      <Pressable
        className="items-center gap-1"
        onPress={onToggleFavorite}
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? "お気に入りから削除" : "お気に入りに追加"}
      >
        <Heart
          size={ACTION_ICON_SIZE}
          color={isFavorite ? COLORS.favorite : COLORS.inactive}
          fill={isFavorite ? COLORS.favorite : "transparent"}
        />
        <Text className="text-text-muted text-xs">{isFavorite ? "保存済み" : "保存"}</Text>
      </Pressable>

      <Pressable
        className="items-center gap-1"
        onPress={onRequestSummary}
        accessibilityRole="button"
        accessibilityLabel="要約を表示"
      >
        <FileText size={ACTION_ICON_SIZE} color={hasSummary ? COLORS.primary : COLORS.inactive} />
        <Text className="text-text-muted text-xs">要約</Text>
      </Pressable>

      <Pressable
        className="items-center gap-1"
        onPress={onRequestTranslation}
        accessibilityRole="button"
        accessibilityLabel="翻訳を表示"
      >
        <Languages
          size={ACTION_ICON_SIZE}
          color={hasTranslation ? COLORS.primary : COLORS.inactive}
        />
        <Text className="text-text-muted text-xs">翻訳</Text>
      </Pressable>

      <Pressable
        className="items-center gap-1"
        onPress={() => Linking.openURL(articleUrl)}
        accessibilityRole="link"
        accessibilityLabel="元の記事を開く"
      >
        <ExternalLink size={ACTION_ICON_SIZE} color={COLORS.inactive} />
        <Text className="text-text-muted text-xs">元記事</Text>
      </Pressable>
    </View>
  );
}
