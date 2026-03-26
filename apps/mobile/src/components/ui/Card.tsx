import { View } from "react-native";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

/**
 * カードコンテナコンポーネント
 *
 * @param children - カード内に表示するコンテンツ
 * @param className - 追加のNativeWindクラス名
 */
export function Card({ children, className = "" }: CardProps) {
  return (
    <View className={`bg-card rounded-xl border border-border p-4 ${className}`}>
      {children}
    </View>
  );
}
