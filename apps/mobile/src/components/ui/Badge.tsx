import { Text, View } from "react-native";

/** Badgeコンポーネントで使用可能なバリアント */
type BadgeVariant = "default" | "success" | "warning" | "error";

type BadgeProps = {
  children: string;
  variant?: BadgeVariant;
};

/** バリアントごとのコンテナスタイル */
const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: "bg-surface border-border",
  success: "bg-success/20 border-success",
  warning: "bg-warning/20 border-warning",
  error: "bg-error/20 border-error",
};

/** バリアントごとのテキストスタイル */
const TEXT_VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: "text-text-muted",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
};

/**
 * ステータス表示用バッジコンポーネント
 *
 * @param children - バッジに表示するテキスト
 * @param variant - バッジの見た目バリアント
 */
export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <View
      className={`rounded-full border px-2.5 py-0.5 self-start ${VARIANT_STYLES[variant]}`}
    >
      <Text className={`text-xs font-medium ${TEXT_VARIANT_STYLES[variant]}`}>
        {children}
      </Text>
    </View>
  );
}
