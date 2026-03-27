import { Clock, User as UserIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { Article } from "@/types/article";

import { Badge } from "./ui/Badge";

/** メタ情報アイコンサイズ */
const META_ICON_SIZE = 12;

/** メタ情報アイコン色 */
const META_ICON_COLOR = "#64748b";

type ArticleCardProps = {
  article: Article;
  onPress?: () => void;
};

/**
 * 記事カードコンポーネント
 *
 * 記事のタイトル、概要、ソース、著者、読了時間を表示する。
 * onPress指定時はPressableとして描画し、タップ可能になる。
 *
 * @param article - 表示する記事データ
 * @param onPress - タップ時のコールバック
 */
export function ArticleCard({ article, onPress }: ArticleCardProps) {
  const content = (
    <View className="bg-card rounded-xl border border-border p-4 gap-2">
      <View className="flex-row items-center gap-2">
        <Badge>{article.source}</Badge>
        {article.isRead && <Badge variant="success">既読</Badge>}
      </View>

      <Text className="text-text text-base font-semibold leading-snug" numberOfLines={2}>
        {article.title}
      </Text>

      {article.excerpt && (
        <Text className="text-text-muted text-sm leading-relaxed" numberOfLines={2}>
          {article.excerpt}
        </Text>
      )}

      <View className="flex-row items-center gap-3 mt-1">
        {article.author && (
          <View className="flex-row items-center gap-1">
            <UserIcon size={META_ICON_SIZE} color={META_ICON_COLOR} />
            <Text className="text-text-dim text-xs">{article.author}</Text>
          </View>
        )}
        {article.readingTimeMinutes !== null && (
          <View className="flex-row items-center gap-1">
            <Clock size={META_ICON_SIZE} color={META_ICON_COLOR} />
            <Text className="text-text-dim text-xs">{article.readingTimeMinutes}分</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return content;
}
