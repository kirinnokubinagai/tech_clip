import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { setAuthToken, setRefreshToken } from "@/lib/secure-store";
import { useAuthStore } from "@/stores/auth-store";

/** コールバック状態 */
type CallbackState = "loading" | "error";

/**
 * トークン受け取り型OAuthコールバック画面
 *
 * ソーシャルログイン後のディープリンク `techclip://auth/callback?token=...` を処理する。
 * APIサーバーが発行したトークンをクエリパラメータで受け取り、セキュアストレージに保存する。
 * セッションを確立してホーム画面へ遷移する。
 *
 * @remarks
 * `(auth)/oauth-callback` との違い:
 * - こちら（auth/callback）はAPIサーバーからトークンを直接受け取るフロー
 * - `(auth)/oauth-callback` はOAuthプロバイダーからcodeを受け取りBetter Authに委譲するフロー
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string; refresh_token?: string; error?: string }>();
  const router = useRouter();
  const checkSession = useAuthStore((s) => s.checkSession);
  const { t } = useTranslation();

  const [state, setState] = useState<CallbackState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (params.error) {
        setErrorMessage(t("auth.authCallback.errorNoToken"));
        setState("error");
        return;
      }

      if (!params.token) {
        setErrorMessage(t("auth.authCallback.errorNoToken"));
        setState("error");
        return;
      }

      if (cancelled) return;
      await setAuthToken(params.token);
      if (params.refresh_token) {
        if (cancelled) return;
        await setRefreshToken(params.refresh_token);
      }

      try {
        if (cancelled) return;
        await checkSession();
        if (cancelled) return;
        router.replace("/(tabs)");
      } catch {
        if (cancelled) return;
        setErrorMessage(t("auth.authCallback.errorCheckSession"));
        setState("error");
      }
    }
    run();

    return () => {
      cancelled = true;
    };
  }, [params.error, params.token, params.refresh_token, checkSession, router, t]);

  if (state === "error") {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text
          className="mb-6 text-center text-base text-error"
          testID="auth-callback-error"
          accessibilityRole="alert"
        >
          {errorMessage}
        </Text>
        <Pressable
          onPress={() => router.replace("/(auth)/login")}
          className="rounded-lg bg-primary px-6 py-3"
          testID="auth-callback-back-button"
          accessibilityRole="button"
          accessibilityLabel={t("auth.authCallback.backToLogin")}
        >
          <Text className="text-base font-semibold text-white">
            {t("auth.authCallback.backToLogin")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator
        size="large"
        testID="auth-callback-loading"
        accessibilityLabel={t("auth.signingIn")}
      />
      <Text className="mt-4 text-sm text-text-muted">{t("auth.signingIn")}</Text>
    </View>
  );
}
