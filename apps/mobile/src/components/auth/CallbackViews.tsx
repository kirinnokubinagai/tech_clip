import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type CallbackErrorViewProps = {
  message: string;
  errorTestId: string;
  backButtonTestId: string;
  onBackToLogin: () => void;
};

type CallbackLoadingViewProps = {
  loadingTestId: string;
  message: string;
};

/**
 * コールバック画面共通エラービュー
 *
 * @param message - 表示するエラーメッセージ（翻訳済み文字列）
 * @param errorTestId - エラーテキストの testID
 * @param backButtonTestId - ボタンの testID
 * @param onBackToLogin - ログイン画面へ戻るハンドラ
 */
export function CallbackErrorView({
  message,
  errorTestId,
  backButtonTestId,
  onBackToLogin,
}: CallbackErrorViewProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text
        className="mb-6 text-center text-base text-error"
        testID={errorTestId}
        accessibilityRole="alert"
      >
        {message}
      </Text>
      <Pressable
        onPress={onBackToLogin}
        className="rounded-lg bg-primary px-6 py-3"
        testID={backButtonTestId}
        accessibilityRole="button"
        accessibilityLabel={t("auth.callback.backToLogin")}
      >
        <Text className="text-base font-semibold text-white">{t("auth.callback.backToLogin")}</Text>
      </Pressable>
    </View>
  );
}

/**
 * コールバック画面共通ローディングビュー
 *
 * @param loadingTestId - ActivityIndicator の testID
 * @param message - 表示テキストおよびアクセシビリティラベル（翻訳済み文字列）
 */
export function CallbackLoadingView({ loadingTestId, message }: CallbackLoadingViewProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" testID={loadingTestId} accessibilityLabel={message} />
      <Text className="mt-4 text-sm text-text-muted">{message}</Text>
    </View>
  );
}
