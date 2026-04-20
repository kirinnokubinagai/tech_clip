import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { useColors } from "@/hooks/use-colors";
import { fetchWithTimeout, getBaseUrl } from "@/lib/api";
import { APP_SCHEME } from "@/lib/constants";

/** Google ブランドロゴのSVG（公式ブランドカラー準拠） */
const GOOGLE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

/** GitHub ロゴのSVG（公式ブランドカラー準拠） */
const GITHUB_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
</svg>`;

/** ソーシャルサインインAPIのパス */
const SOCIAL_SIGN_IN_PATH = "/api/auth/sign-in/social";

/** ソーシャル認証後のコールバックURL */
const SOCIAL_CALLBACK_URL = `${APP_SCHEME}://auth/callback`;

export type SocialProvider = "google" | "github";

/**
 * ソーシャルサインインAPIレスポンスにリダイレクトURLが含まれるか判定する
 */
function hasSocialRedirectUrl(value: unknown): value is { url: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof (value as { url?: unknown }).url === "string"
  );
}

type OAuthButtonsProps = {
  /** "login" のときはログイン用ラベル、"signup" のときは登録用ラベルを表示する */
  mode: "login" | "signup";
  /** 他のフォーム送信が進行中かどうか */
  isAnySubmitting: boolean;
  /** エラー発生時のコールバック */
  onError: (message: string) => void;
  /** ローディング中プロバイダーの状態を外部に通知するコールバック */
  onLoadingChange: (provider: SocialProvider | null) => void;
  /** 現在ローディング中のプロバイダー */
  loadingProvider: SocialProvider | null;
};

type ProviderConfig = {
  provider: SocialProvider;
  loginKey: string;
  signupKey: string;
};

/** ソーシャルプロバイダー設定 */
const PROVIDER_CONFIGS: ReadonlyArray<ProviderConfig> = [
  {
    provider: "google",
    loginKey: "auth.continueWithGoogle",
    signupKey: "auth.signUpWithGoogle",
  },
  {
    provider: "github",
    loginKey: "auth.continueWithGithub",
    signupKey: "auth.signUpWithGithub",
  },
];

/**
 * OAuth ソーシャルログイン／登録ボタン群
 *
 * login.tsx および register.tsx の両方から使用する共通コンポーネント。
 * mode="login" でログイン用ラベル、mode="signup" で登録用ラベルに切り替わる。
 * Better Auth の signInSocial は OAuth 初回時に自動でアカウント作成を行うため、
 * ログインと登録のどちらの画面から呼び出しても同じエンドポイントで動作する。
 */
export function OAuthButtons({
  mode,
  isAnySubmitting,
  onError,
  onLoadingChange,
  loadingProvider,
}: OAuthButtonsProps) {
  const { t } = useTranslation();
  const colors = useColors();

  /**
   * ソーシャル認証を開始する
   *
   * @param provider - 利用するソーシャルプロバイダー
   */
  const handleSocialSignIn = async (provider: SocialProvider) => {
    onError("");
    onLoadingChange(provider);

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
        onError(t("auth.socialLoginFailed"));
        return;
      }

      const responseBody: unknown = await response.json();
      if (!hasSocialRedirectUrl(responseBody) || !responseBody.url.startsWith("https://")) {
        onError(t("auth.socialLoginFailed"));
        return;
      }

      await Linking.openURL(responseBody.url);
    } catch {
      onError(t("auth.socialLoginFailed"));
    } finally {
      onLoadingChange(null);
    }
  };

  return (
    <View className="gap-3">
      {PROVIDER_CONFIGS.map(({ provider, loginKey, signupKey }) => {
        const translationKey = mode === "login" ? loginKey : signupKey;
        return (
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
            {loadingProvider === provider ? (
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
                  <SvgXml xml={GITHUB_LOGO_SVG} width={20} height={20} color={colors.text} />
                )}
                <Text className="text-base font-medium text-text">{t(translationKey)}</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
