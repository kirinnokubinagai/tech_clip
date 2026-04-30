import { Text, View } from "react-native";

type AuthAlertVariant = "error" | "success";

type AuthAlertProps = {
  message: string;
  variant?: AuthAlertVariant;
};

const AUTH_ALERT_STYLES: Record<
  AuthAlertVariant,
  { containerClassName: string; textClassName: string }
> = {
  error: {
    containerClassName: "mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3",
    textClassName: "text-sm text-error",
  },
  success: {
    containerClassName: "mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3",
    textClassName: "text-sm text-success",
  },
};

/**
 * 認証画面用のメッセージアラート
 *
 * @param message - 表示するメッセージ
 * @param variant - 表示スタイル
 */
export function AuthAlert({ message, variant = "error" }: AuthAlertProps) {
  const styles = AUTH_ALERT_STYLES[variant];

  return (
    <View
      testID={variant === "success" ? "auth-alert-success" : "auth-alert-error"}
      className={styles.containerClassName}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Text className={styles.textClassName}>{message}</Text>
    </View>
  );
}
