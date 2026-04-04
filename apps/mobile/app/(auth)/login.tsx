import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { UI_COLORS } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";

/** パスワード最小文字数 */
const PASSWORD_MIN_LENGTH = 8;

/**
 * ログイン画面
 * メール・パスワード入力、ログインボタン、新規登録リンクを表示する
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  /**
   * フォームのバリデーションを実行する
   *
   * @returns バリデーションエラーメッセージ。正常時は空文字
   */
  const validate = (): string => {
    if (!email.trim()) {
      return t("auth.validation.emailRequired");
    }
    if (!password) {
      return t("auth.validation.passwordRequired");
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return t("auth.validation.passwordMinLength", { min: PASSWORD_MIN_LENGTH });
    }
    return "";
  };

  const isFormValid = email.trim().length > 0 && password.length >= PASSWORD_MIN_LENGTH;

  /**
   * ログインフォームを送信する
   */
  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await signIn({ email: email.trim(), password });
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t("auth.loginFailed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        <View className="mb-12 items-center">
          <Text className="text-4xl font-bold text-text">TechClip</Text>
          <Text className="mt-2 text-base text-text-muted">{t("auth.appTagline")}</Text>
        </View>

        <View className="rounded-2xl bg-surface p-6">
          <Text className="mb-6 text-center text-xl font-semibold text-text">
            {t("auth.loginTitle")}
          </Text>

          {errorMessage !== "" && (
            <View
              className="mb-4 rounded-lg bg-error/10 px-4 py-3"
              accessibilityRole="alert"
              accessibilityLabel={errorMessage}
            >
              <Text className="text-sm text-error">{errorMessage}</Text>
            </View>
          )}

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-text-muted">{t("auth.email")}</Text>
            <TextInput
              className="rounded-lg border border-border bg-card px-4 py-3 text-base text-text"
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={UI_COLORS.textDim}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isSubmitting}
              testID="login-email-input"
              accessibilityLabel="メールアドレス"
              accessibilityHint="メールアドレスを入力してください"
            />
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-text-muted">{t("auth.password")}</Text>
            <View className="flex-row items-center rounded-lg border border-border bg-card">
              <TextInput
                className="flex-1 px-4 py-3 text-base text-text"
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor={UI_COLORS.textDim}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                editable={!isSubmitting}
                testID="login-password-input"
                accessibilityLabel="パスワード"
                accessibilityHint="8文字以上のパスワードを入力してください"
              />
              <Pressable
                onPress={() => setIsPasswordVisible((prev) => !prev)}
                className="px-4 py-3"
                accessibilityLabel={
                  isPasswordVisible ? t("auth.passwordHideLabel") : t("auth.passwordShowLabel")
                }
                testID="login-toggle-password"
              >
                <Text className="text-sm text-text-muted">
                  {isPasswordVisible ? t("auth.passwordHide") : t("auth.passwordShow")}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting || !isFormValid}
            className={`items-center rounded-lg py-4 ${
              isSubmitting || !isFormValid ? "bg-primary/50" : "bg-primary"
            }`}
            testID="login-submit-button"
            accessibilityRole="button"
            accessibilityLabel="ログイン"
            accessibilityHint="メールアドレスとパスワードでログインします"
            accessibilityState={{ disabled: isSubmitting || !isFormValid }}
          >
            {isSubmitting ? (
              <ActivityIndicator color={UI_COLORS.text} />
            ) : (
              <Text className="text-base font-semibold text-text">{t("auth.login")}</Text>
            )}
          </Pressable>
        </View>

        <View className="mt-6 flex-row items-center justify-center">
          <Text className="text-sm text-text-muted">{t("auth.loginToRegisterPrompt")}</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable testID="login-register-link">
              <Text className="ml-1 text-sm font-semibold text-primary">
                {t("auth.loginToRegister")}
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
