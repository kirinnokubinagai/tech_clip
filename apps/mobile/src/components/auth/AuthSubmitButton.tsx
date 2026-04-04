import { ActivityIndicator, Pressable, Text } from "react-native";
import { AUTH_LOADING_INDICATOR_COLOR } from "@/lib/ui-colors";

type AuthSubmitButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityHint?: string;
  textClassName?: string;
  className?: string;
};

/**
 * 認証画面用の送信ボタン
 *
 * @param label - ボタンラベル
 * @param onPress - 押下時の処理
 * @param disabled - 無効状態
 * @param testID - テストID
 * @param accessibilityHint - 補足説明
 * @param textClassName - ラベルの文字色
 * @param className - 追加クラス
 */
export function AuthSubmitButton({
  label,
  onPress,
  disabled = false,
  testID,
  accessibilityHint,
  textClassName = "text-base font-semibold text-white",
  className = "items-center rounded-lg bg-primary py-3.5",
}: AuthSubmitButtonProps) {
  return (
    <Pressable
      className={className}
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
      {disabled ? (
        <ActivityIndicator color={AUTH_LOADING_INDICATOR_COLOR} />
      ) : (
        <Text className={textClassName}>{label}</Text>
      )}
    </Pressable>
  );
}
