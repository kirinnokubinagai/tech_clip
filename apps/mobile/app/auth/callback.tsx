import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import { setAuthToken, setRefreshToken } from "@/lib/secure-store";
import { useAuthStore } from "@/stores/auth-store";

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

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (params.error) {
          if (cancelled) return;
          router.replace("/(auth)/login");
          return;
        }

        if (!params.token) {
          if (cancelled) return;
          router.replace("/(auth)/login");
          return;
        }

        if (cancelled) return;
        await setAuthToken(params.token);
        if (params.refresh_token) {
          if (cancelled) return;
          await setRefreshToken(params.refresh_token);
        }

        if (cancelled) return;
        await checkSession();
        if (cancelled) return;
        router.replace("/(tabs)");
      } catch {
        if (cancelled) return;
        router.replace("/(auth)/login");
      }
    }
    run();

    return () => {
      cancelled = true;
    };
  }, [params.error, params.token, params.refresh_token, checkSession, router]);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" />
      <Text className="mt-4 text-text-muted">{t("auth.signingIn")}</Text>
    </View>
  );
}
