import type { TextInputProps } from "react-native";
import { Text, TextInput, View } from "react-native";

import { DARK_COLORS } from "@/lib/constants";

/** プレースホルダーの色（テーマのtext-dimに対応） */
const PLACEHOLDER_COLOR = DARK_COLORS.textDim;

type InputProps = {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  editable?: boolean;
};

/**
 * テキスト入力コンポーネント
 *
 * @param label - 入力フィールドのラベル
 * @param placeholder - プレースホルダーテキスト
 * @param value - 入力値
 * @param onChangeText - テキスト変更時のコールバック
 * @param error - エラーメッセージ（表示時にボーダーが赤くなる）
 * @param secureTextEntry - パスワード入力モード
 * @param keyboardType - キーボードタイプ
 * @param autoCapitalize - 自動大文字化設定
 * @param editable - 編集可能かどうか
 */
export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize = "none",
  editable = true,
}: InputProps) {
  const borderStyle = error ? "border-error" : "border-border";
  const inputStyle = `bg-surface ${borderStyle} border rounded-lg px-4 py-3 text-text text-base`;

  return (
    <View className="gap-1.5">
      {label && <Text className="text-text text-sm font-medium">{label}</Text>}
      <TextInput
        testID="input-field"
        className={inputStyle}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        accessibilityLabel={label}
        accessibilityState={{ disabled: !editable }}
      />
      {error && <Text className="text-error text-sm">{error}</Text>}
    </View>
  );
}
