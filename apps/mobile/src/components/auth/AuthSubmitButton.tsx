import { ActivityIndicator, Pressable, Text } from "react-native";
import { twMerge } from "tailwind-merge";
import { DARK_COLORS } from "@/lib/constants";

type AuthSubmitButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  indicatorColor?: string;
  testID?: string;
  accessibilityHint?: string;
  textClassName?: string;
  className?: string;
};

const BASE_BUTTON_CLASS_NAME = "items-center rounded-lg bg-primary py-3.5";
const BASE_TEXT_CLASS_NAME = "text-base font-semibold text-white";

/**
 * 認証画面用の送信ボタン
 *
 * @param label - ボタンラベル
 * @param onPress - 押下時の処理
 * @param disabled - 無効状態
 * @param isLoading - ローディング状態
 * @param indicatorColor - ローディングインジケーターの色
 * @param testID - テストID
 * @param accessibilityHint - 補足説明
 * @param textClassName - ラベルのテキストスタイル（サイズ・ウェイト・色）
 * @param className - 追加クラス
 */
export function AuthSubmitButton({
  label,
  onPress,
  disabled = false,
  isLoading = false,
  indicatorColor = DARK_COLORS.white,
  testID,
  accessibilityHint,
  textClassName,
  className,
}: AuthSubmitButtonProps) {
  return (
    <Pressable
      className={twMerge(BASE_BUTTON_CLASS_NAME, className)}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        opacity: pressed || disabled ? 0.7 : 1,
      })}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      {isLoading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <Text className={twMerge(BASE_TEXT_CLASS_NAME, textClassName)}>{label}</Text>
      )}
    </Pressable>
  );
}
