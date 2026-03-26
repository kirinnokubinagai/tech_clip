import { Pressable, View } from "react-native";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
};

/**
 * カードコンテナコンポーネント
 *
 * onPress指定時はPressableとして描画し、タップ可能になる。
 * 未指定時はViewとして描画する。
 *
 * @param children - カード内に表示するコンテンツ
 * @param className - 追加のNativeWindクラス名
 * @param onPress - タップ時のコールバック（指定時はpressable化）
 */
export function Card({ children, className = "", onPress }: CardProps) {
  const cardStyle = `bg-card rounded-xl border border-border p-4 ${className}`;

  if (onPress) {
    return (
      <Pressable className={cardStyle} onPress={onPress} accessibilityRole="button">
        {children}
      </Pressable>
    );
  }

  return (
    <View className={cardStyle}>
      {children}
    </View>
  );
}
