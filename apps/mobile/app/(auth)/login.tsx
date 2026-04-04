import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { fetchWithTimeout, getBaseUrl } from "@/lib/api";
import { AUTH_LOADING_INDICATOR_COLOR, AUTH_PLACEHOLDER_TEXT_COLOR } from "@/lib/ui-colors";
import { EMAIL_SIMPLE_REGEX } from "@/lib/validation";
import { useAuthStore } from "@/stores/auth-store";

/** パスワード最小文字数 */
const PASSWORD_MIN_LENGTH = 8;
/** ソーシャルサインインAPIのパス */
const SOCIAL_SIGN_IN_PATH = "/api/auth/sign-in/social";
/** ソーシャルログイン後のコールバックURL */
const SOCIAL_CALLBACK_URL = "techclip://";

type SocialProvider = "google" | "github";

type SocialSignInResponse = {
  url?: string;
};

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
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return t("auth.validation.emailRequired");
    }
    if (!EMAIL_SIMPLE_REGEX.test(trimmedEmail)) {
      return t("auth.validation.emailInvalid");
    }
    if (!password) {
      return t("auth.validation.passwordRequired");
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return t("auth.validation.passwordMinLength", { min: PASSWORD_MIN_LENGTH });
    }
    return "";
  };

  const isFormValid =
    EMAIL_SIMPLE_REGEX.test(email.trim()) && password.length >= PASSWORD_MIN_LENGTH;

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

  /**
   * ソーシャルログインを開始する
   *
   * @param provider - 利用するソーシャルプロバイダー
   */
  const handleSocialSignIn = async (provider: SocialProvider) => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetchWithTimeout(`${getBaseUrl()}${SOCIAL_SIGN_IN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          callbackURL: SOCIAL_CALLBACK_URL,
          disableRedirect: true,
        }),
      });
      const data = (await response.json()) as SocialSignInResponse;

      if (!response.ok || !data.url?.startsWith("https://")) {
        setErrorMessage(t("auth.socialLoginFailed"));
        return;
      }

      await Linking.openURL(data.url);
    } catch {
      setErrorMessage(t("auth.socialLoginFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
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
              placeholderTextColor={AUTH_PLACEHOLDER_TEXT_COLOR}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isSubmitting}
              testID="login-email-input"
              accessibilityLabel={t("auth.email")}
              accessibilityHint={t("auth.emailHint")}
            />
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-text-muted">{t("auth.password")}</Text>
            <View className="flex-row items-center rounded-lg border border-border bg-card">
              <TextInput
                className="flex-1 px-4 py-3 text-base text-text"
                placeholder={t("auth.passwordPlaceholder")}
                placeholderTextColor={AUTH_PLACEHOLDER_TEXT_COLOR}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                editable={!isSubmitting}
                testID="login-password-input"
                accessibilityLabel={t("auth.password")}
                accessibilityHint={t("auth.passwordHint", { min: PASSWORD_MIN_LENGTH })}
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

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable
              className="mb-6 self-start"
              accessibilityRole="link"
              accessibilityLabel={t("auth.forgotPassword")}
            >
              <Text className="text-sm font-medium text-primary">{t("auth.forgotPassword")}</Text>
            </Pressable>
          </Link>

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            className="items-center rounded-lg bg-primary py-4"
            style={({ pressed }) => ({
              opacity: pressed || isSubmitting ? 0.7 : 1,
            })}
            testID="login-submit-button"
            accessibilityRole="button"
            accessibilityLabel={t("auth.login")}
            accessibilityHint={t("auth.loginHint")}
            accessibilityState={{ disabled: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color={AUTH_LOADING_INDICATOR_COLOR} />
            ) : (
              <Text className="text-base font-semibold text-text">{t("auth.login")}</Text>
            )}
          </Pressable>

          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1 bg-border" />
            <Text className="mx-3 text-sm text-text-muted">{t("auth.socialSeparator")}</Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          <View className="gap-3">
            <Pressable
              onPress={() => handleSocialSignIn("google")}
              disabled={isSubmitting}
              className="items-center rounded-lg border border-border bg-card py-3.5"
              style={({ pressed }) => ({
                opacity: pressed || isSubmitting ? 0.7 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={t("auth.continueWithGoogle")}
              accessibilityState={{ disabled: isSubmitting }}
            >
              <Text className="text-base font-medium text-text">
                {t("auth.continueWithGoogle")}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleSocialSignIn("github")}
              disabled={isSubmitting}
              className="items-center rounded-lg border border-border bg-card py-3.5"
              style={({ pressed }) => ({
                opacity: pressed || isSubmitting ? 0.7 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={t("auth.continueWithGithub")}
              accessibilityState={{ disabled: isSubmitting }}
            >
              <Text className="text-base font-medium text-text">
                {t("auth.continueWithGithub")}
              </Text>
            </Pressable>
          </View>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
