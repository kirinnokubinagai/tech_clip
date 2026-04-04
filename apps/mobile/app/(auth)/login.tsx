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

import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { fetchWithTimeout, getBaseUrl } from "@/lib/api";
import { APP_SCHEME, DARK_COLORS } from "@/lib/constants";
import { EMAIL_SIMPLE_REGEX, PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { useAuthStore } from "@/stores/auth-store";

/** ソーシャルサインインAPIのパス */
const SOCIAL_SIGN_IN_PATH = "/api/auth/sign-in/social";
/** ソーシャルログイン後のコールバックURL。deep link path が必要になったら constants 側へ移す。 */
const SOCIAL_CALLBACK_URL = `${APP_SCHEME}://`;

type SocialProvider = "google" | "github";

type SocialSignInResponse = {
  url?: string;
};

const SOCIAL_PROVIDERS: ReadonlyArray<{ provider: SocialProvider; translationKey: string }> = [
  { provider: "google", translationKey: "auth.continueWithGoogle" },
  { provider: "github", translationKey: "auth.continueWithGithub" },
];

function isSocialSignInResponse(value: unknown): value is SocialSignInResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("url" in value)) {
    return true;
  }

  return typeof (value as { url?: unknown }).url === "string";
}

/**
 * ログイン画面
 * メール・パスワード入力、ログインボタン、新規登録リンクを表示する
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [socialSigningInProvider, setSocialSigningInProvider] = useState<SocialProvider | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isSocialSubmitting = socialSigningInProvider !== null;
  const isAnySubmitting = isEmailSubmitting || isSocialSubmitting;

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

  /**
   * ソーシャルログインを開始する
   *
   * @param provider - 利用するソーシャルプロバイダー
   */
  const handleSocialSignIn = async (provider: SocialProvider) => {
    setErrorMessage("");
    setSocialSigningInProvider(provider);

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

      if (!response.ok) {
        setErrorMessage(t("auth.socialLoginFailed"));
        return;
      }

      const responseBody: unknown = await response.json();
      const data = isSocialSignInResponse(responseBody) ? responseBody : {};

      if (!data.url?.startsWith("https://")) {
        setErrorMessage(t("auth.socialLoginFailed"));
        return;
      }

      await Linking.openURL(data.url);
    } catch {
      setErrorMessage(t("auth.socialLoginFailed"));
    } finally {
      setSocialSigningInProvider(null);
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

          {errorMessage !== "" && <AuthAlert message={errorMessage} />}

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-text-muted">{t("auth.email")}</Text>
            <TextInput
              className="rounded-lg border border-border bg-card px-4 py-3 text-base text-text"
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={DARK_COLORS.textDim}
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
                placeholderTextColor={DARK_COLORS.textDim}
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

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable
              className="mb-6 self-start"
              accessibilityRole="link"
              accessibilityLabel={t("auth.forgotPassword")}
            >
              <Text className="text-sm font-medium text-primary">{t("auth.forgotPassword")}</Text>
            </Pressable>
          </Link>

          <AuthSubmitButton
            onPress={handleSubmit}
            disabled={isAnySubmitting}
            isLoading={isEmailSubmitting}
            className="py-4"
            testID="login-submit-button"
            accessibilityHint={t("auth.loginHint")}
            label={t("auth.login")}
            indicatorColor={DARK_COLORS.text}
            textClassName="text-base font-semibold text-text"
          />

          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1 bg-border" />
            <Text className="mx-3 text-sm text-text-muted">{t("auth.socialSeparator")}</Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          <View className="gap-3">
            {SOCIAL_PROVIDERS.map(({ provider, translationKey }) => (
              <Pressable
                key={provider}
                onPress={() => handleSocialSignIn(provider)}
                disabled={isAnySubmitting}
                className="items-center rounded-lg border border-border bg-card py-3.5"
                style={({ pressed }) => ({
                  opacity: pressed || isAnySubmitting ? 0.7 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel={t(translationKey)}
                accessibilityState={{ disabled: isAnySubmitting }}
                testID={`social-signin-${provider}`}
              >
                {socialSigningInProvider === provider ? (
                  <ActivityIndicator
                    color={DARK_COLORS.text}
                    size="small"
                    testID={`social-signin-${provider}-loading`}
                  />
                ) : (
                  <Text className="text-base font-medium text-text">{t(translationKey)}</Text>
                )}
              </Pressable>
            ))}
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
