import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "./Button";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * 空状態を表示するコンポーネント
 *
 * データが存在しない画面で、アイコン・メッセージ・オプションのアクションボタンを表示する。
 *
 * @param icon - 中央に表示するアイコン（Lucide等のReactNode）
 * @param title - メインメッセージ
 * @param description - 補足説明テキスト
 * @param actionLabel - アクションボタンのラベル（指定時のみボタン表示）
 * @param onAction - アクションボタンのタップコールバック
 * @param className - 追加のNativeWindクラス名
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <View
      className={`flex-1 items-center justify-center px-8 py-12 ${className}`}
      accessibilityRole="text"
      accessibilityLabel={description ? `${title}。${description}` : title}
    >
      <View
        className="mb-4"
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        {icon}
      </View>
      <Text className="text-lg font-semibold text-text text-center">{title}</Text>
      {description ? (
        <Text className="mt-2 text-sm text-text-muted text-center">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-6">
          <Button onPress={onAction}>{actionLabel}</Button>
        </View>
      ) : null}
    </View>
  );
}
