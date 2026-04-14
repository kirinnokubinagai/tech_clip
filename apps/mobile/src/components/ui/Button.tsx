import { ActivityIndicator, Pressable, Text } from "react-native";

import { useColors } from "@/hooks/use-colors";

/** Buttonコンポーネントで使用可能なバリアント */
type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

/** Buttonコンポーネントで使用可能なサイズ */
type ButtonSize = "sm" | "md" | "lg";

/** useColors() の戻り値型 */
type ThemeColors = ReturnType<typeof useColors>;

type ButtonProps = {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  testID?: string;
};

/** バリアントごとのコンテナスタイル */
const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "bg-surface border border-border",
  outline: "border border-border",
  ghost: "",
  danger: "bg-error",
};

/** バリアントごとのテキストスタイル */
const TEXT_VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "text-white font-semibold",
  secondary: "text-text font-medium",
  outline: "text-text font-medium",
  ghost: "text-text-muted font-medium",
  danger: "text-white font-semibold",
};

/** サイズごとのコンテナスタイル */
const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2.5",
  lg: "px-6 py-3.5",
};

/** サイズごとのテキストスタイル */
const TEXT_SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

/**
 * バリアントに対応するローディングインジケーターの色を返す
 *
 * @param variant - ボタンバリアント
 * @param colors - 現在のテーマカラートークン
 * @returns ActivityIndicator に渡す色
 */
function getIndicatorColor(variant: ButtonVariant, colors: ThemeColors): string {
  switch (variant) {
    case "primary":
    case "danger":
      return colors.white;
    case "secondary":
    case "outline":
      return colors.text;
    case "ghost":
      return colors.textMuted;
  }
}

/**
 * 汎用ボタンコンポーネント
 *
 * @param children - ボタンに表示するテキスト
 * @param variant - ボタンの見た目バリアント
 * @param size - ボタンのサイズ
 * @param disabled - 無効状態
 * @param loading - ローディング状態（trueでdisabled化しActivityIndicatorを表示）
 * @param onPress - タップ時のコールバック
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  onPress,
  testID = "button",
}: ButtonProps) {
  const colors = useColors();
  const isDisabled = disabled || loading;
  const containerStyle = `rounded-lg items-center justify-center ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${isDisabled ? "opacity-50" : ""}`;
  const textStyle = `${TEXT_VARIANT_STYLES[variant]} ${TEXT_SIZE_STYLES[size]}`;
  const indicatorColor = getIndicatorColor(variant, colors);

  return (
    <Pressable
      testID={testID}
      className={containerStyle}
      disabled={isDisabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <Text className={textStyle}>{children}</Text>
      )}
    </Pressable>
  );
}
