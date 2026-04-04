import { Text, View } from "react-native";
import { getSourceDefinition } from "@/lib/sources";
import type { ArticleSource } from "@/types/article";

export { SOURCE_CONFIG } from "@/lib/sources";

/** バッジのサイズバリアント */
type BadgeSize = "sm" | "md";

type SourceBadgeProps = {
  source: ArticleSource;
  size?: BadgeSize;
};

/** サイズごとのスタイル */
const SIZE_STYLES: Record<BadgeSize, { container: string; text: string }> = {
  sm: { container: "px-2 py-0.5", text: "text-xs" },
  md: { container: "px-2.5 py-1", text: "text-sm" },
};

/**
 * 記事のソースサイトを表示するバッジコンポーネント
 *
 * @param source - ソースサイト名
 * @param size - バッジサイズ（デフォルト: sm）
 */
export function SourceBadge({ source, size = "sm" }: SourceBadgeProps) {
  const config = getSourceDefinition(source);
  const sizeStyle = SIZE_STYLES[size];

  return (
    <View
      testID="source-badge"
      className={`rounded-full self-start ${sizeStyle.container} ${config.badgeClassName.split(" ")[0]}`}
      accessibilityLabel={config.label}
    >
      <Text className={`font-medium ${sizeStyle.text} ${config.badgeClassName.split(" ")[1]}`}>
        {config.label}
      </Text>
    </View>
  );
}
