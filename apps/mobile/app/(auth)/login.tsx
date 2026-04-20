import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";

import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { useColors } from "@/hooks/use-colors";
import { fetchWithTimeout, getBaseUrl } from "@/lib/api";
import { APP_SCHEME } from "@/lib/constants";
import { EMAIL_SIMPLE_REGEX, PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { useAuthStore } from "@/stores/auth-store";

/** Google ブランドロゴのSVG（公式ブランドカラー準拠） */
const GOOGLE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

/** GitHub ロゴのSVG（公式ブランドカラー準拠: ライト/ダークテーマ非依存の中間色） */
const GITHUB_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#24292f" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
</svg>`;

/** ソーシャルサインインAPIのパス */
const SOCIAL_SIGN_IN_PATH = "/api/auth/sign-in/social";
/** ソーシャルログイン後のコールバックURL。deep link path が必要になったら constants 側へ移す。 */
const SOCIAL_CALLBACK_URL = `${APP_SCHEME}://auth/callback`;

/**
 * ソーシャルログインAPIレスポンスにリダイレクトURLが含まれるか判定する
 */
function hasSocialRedirectUrl(value: unknown): value is { url: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof (value as { url?: unknown }).url === "string"
  );
}

type SocialProvider = "google" | "github";

const SOCIAL_PROVIDERS: ReadonlyArray<{ provider: SocialProvider; translationKey: string }> = [
  { provider: "google", translationKey: "auth.continueWithGoogle" },
  { provider: "github", translationKey: "auth.continueWithGithub" },
];

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
  const [socialSigningInProvider, setSocialSigningInProvider] = useState<SocialProvider | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    if (!sessionExpiredMessage) {
      return;
    }
    setErrorMessage(sessionExpiredMessage);
    clearSessionExpiredMessage();
  }, [sessionExpiredMessage, clearSessionExpiredMessage]);
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
      if (!hasSocialRedirectUrl(responseBody) || !responseBody.url.startsWith("https://")) {
        setErrorMessage(t("auth.socialLoginFailed"));
        return;
      }

      await Linking.openURL(responseBody.url);
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
            indicatorColor={colors.text}
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
                className="flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card py-3.5"
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
                    color={colors.text}
                    size="small"
                    testID={`social-signin-${provider}-loading`}
                  />
                ) : (
                  <>
                    {provider === "google" ? (
                      <SvgXml xml={GOOGLE_LOGO_SVG} width={20} height={20} />
                    ) : (
                      <SvgXml xml={GITHUB_LOGO_SVG} width={20} height={20} />
                    )}
                    <Text className="text-base font-medium text-text">{t(translationKey)}</Text>
                  </>
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
