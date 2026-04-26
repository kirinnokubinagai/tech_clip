import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { OAuthButtons, type SocialProvider } from "@/components/auth/OAuthButtons";
import { useColors } from "@/hooks/use-colors";
import { EMAIL_SIMPLE_REGEX, PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { useAuthStore } from "@/stores/auth-store";

/**
 * ログイン画面
 * メール・パスワード入力、ログインボタン、新規登録リンクを表示する
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const signIn = useAuthStore((s) => s.signIn);
  const sessionExpiredMessage = useAuthStore((s) => s.sessionExpiredMessage);
  const clearSessionExpiredMessage = useAuthStore((s) => s.clearSessionExpiredMessage);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<SocialProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    if (!sessionExpiredMessage) {
      return;
    }
    setErrorMessage(sessionExpiredMessage);
    clearSessionExpiredMessage();
  }, [sessionExpiredMessage, clearSessionExpiredMessage]);

  const isAnySubmitting = isEmailSubmitting || socialLoadingProvider !== null;

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
    setIsEmailSubmitting(true);

    try {
      await signIn({ email: email.trim(), password });
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t("auth.loginFailed"));
      }
    } finally {
      setIsEmailSubmitting(false);
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
          <Image
            source={require("../../assets/images/icon.png")}
            style={{ width: 80, height: 80, marginBottom: 16 }}
            resizeMode="contain"
            accessibilityLabel="TechClip logo"
          />
          <Text className="text-4xl font-bold text-text">TechClip</Text>
          <Text className="mt-2 text-base text-text-muted">{t("auth.appTagline")}</Text>
        </View>

        <View className="rounded-2xl bg-surface p-6">
          <Text className="mb-6 text-center text-xl font-semibold text-text">
            {t("auth.loginTitle")}
          </Text>

          {errorMessage !== "" && <AuthAlert message={errorMessage} />}

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-text-muted">{t("auth.email")}</Text>
            <TextInput
              className="rounded-lg border border-border bg-card px-4 py-3 text-base text-text"
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={colors.textDim}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isAnySubmitting}
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
                placeholderTextColor={colors.textDim}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                editable={!isAnySubmitting}
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

          <Link
            href="/(auth)/forgot-password"
            testID="login-forgot-password-link"
            className="mb-6 self-start"
            accessibilityLabel={t("auth.forgotPassword")}
          >
            <Text className="text-sm font-medium text-primary">{t("auth.forgotPassword")}</Text>
          </Link>

          <AuthSubmitButton
            onPress={handleSubmit}
            disabled={isAnySubmitting}
            isLoading={isEmailSubmitting}
            className="py-4"
            testID="login-submit-button"
            accessibilityHint={t("auth.loginHint")}
            label={t("auth.login")}
            indicatorColor={colors.text}
            textClassName="text-base font-semibold text-text"
          />

          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1 bg-border" />
            <Text className="mx-3 text-sm text-text-muted">{t("auth.socialSeparator")}</Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          <OAuthButtons
            mode="login"
            isAnySubmitting={isAnySubmitting}
            onError={setErrorMessage}
            onLoadingChange={setSocialLoadingProvider}
            loadingProvider={socialLoadingProvider}
          />
        </View>

        <View className="mt-6 flex-row items-center justify-center">
          <Text className="text-sm text-text-muted">{t("auth.loginToRegisterPrompt")}</Text>
          <Link href="/(auth)/register" testID="login-register-link">
            <Text className="ml-1 text-sm font-semibold text-primary">
              {t("auth.loginToRegister")}
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
