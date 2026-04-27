import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";

import { useColors } from "@/hooks/use-colors";
import { fetchWithTimeout, getBaseUrl } from "@/lib/api";
import { logger } from "@/lib/logger";
import { removeOAuthState, setOAuthState } from "@/lib/secure-store";

/** Google ブランドロゴのSVG（公式ブランドカラー準拠） */
const GOOGLE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

/**
 * テーマに応じた fill 色を埋め込んだ GitHub ロゴ SVG を生成する
 *
 * @param fillColor - fill 色（ライト: "#1c1917"、ダーク: "#e2e8f0"）
 * @returns fill 色が直接埋め込まれた SVG 文字列
 */
function buildGithubSvg(fillColor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="${fillColor}" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
</svg>`;
}

/**
 * テーマに応じた fill 色を埋め込んだ Apple ロゴ SVG を生成する
 *
 * @param fillColor - fill 色（ライト: "#1c1917"、ダーク: "#e2e8f0"）
 * @returns fill 色が直接埋め込まれた SVG 文字列
 */
function buildAppleSvg(fillColor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
  <path fill="${fillColor}" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
</svg>`;
}

/** ソーシャルサインインAPIのパス */
const SOCIAL_SIGN_IN_PATH = "/api/auth/sign-in/social";

/** ソーシャル認証後のモバイル OAuth コールバックパス */
const MOBILE_OAUTH_CALLBACK_PATH = "/api/auth/mobile-callback";

export type SocialProvider = "google" | "github" | "apple";

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
  {
    provider: "apple",
    loginKey: "auth.continueWithApple",
    signupKey: "auth.signUpWithApple",
  },
];

/**
 * OAuth ソーシャルログイン／登録ボタン群
 *
 * login.tsx および register.tsx の両方から使用する共通コンポーネント。
 * mode="login" でログイン用ラベル、mode="signup" で登録用ラベルに切り替わる。
 * Better Auth の signInSocial は OAuth 初回時に自動でアカウント作成を行うため、
 * ログインと登録のどちらの画面から呼び出しても同じエンドポイントで動作する。
 *
 * GitHub・Apple アイコンは SvgXml の color prop では currentColor が
 * 正常に伝播しないため、buildGithubSvg / buildAppleSvg でテーマ色を
 * fill 値として SVG 文字列に直接埋め込む方式を採用している。
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
  const colorScheme = useColorScheme();

  /** GitHub・Apple アイコンの fill 色（null はダークとして扱う） */
  const monoIconFill = colorScheme === "light" ? "#000000" : "#ffffff";
  const githubSvg = buildGithubSvg(monoIconFill);
  const appleSvg = buildAppleSvg(monoIconFill);

  /**
   * ソーシャル認証を開始する
   *
   * @param provider - 利用するソーシャルプロバイダー
   */
  const handleSocialSignIn = async (provider: SocialProvider) => {
    onError("");
    onLoadingChange(provider);

    try {
      const oauthState = crypto.randomUUID();
      await setOAuthState(oauthState);

      const callbackWithState = `${getBaseUrl()}${MOBILE_OAUTH_CALLBACK_PATH}?state=${encodeURIComponent(oauthState)}`;
      const response = await fetchWithTimeout(`${getBaseUrl()}${SOCIAL_SIGN_IN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          callbackURL: callbackWithState,
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
    } catch (error) {
      logger.warn("OAuth ログイン処理中にエラーが発生しました", {
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      });
      await removeOAuthState();
      onError(t("auth.socialLoginFailed"));
    } finally {
      onLoadingChange(null);
    }
  };

  return (
    <View className="gap-3">
      {PROVIDER_CONFIGS.filter((p) => p.provider !== "apple" || Platform.OS === "ios").map(
        ({ provider, loginKey, signupKey }) => {
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
                  ) : provider === "apple" ? (
                    <SvgXml xml={appleSvg} width={20} height={20} />
                  ) : (
                    <SvgXml xml={githubSvg} width={20} height={20} />
                  )}
                  <Text className="text-base font-medium text-text">{t(translationKey)}</Text>
                </>
              )}
            </Pressable>
          );
        },
      )}
    </View>
  );
}
