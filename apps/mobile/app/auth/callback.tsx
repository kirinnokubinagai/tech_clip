import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import { setAuthToken, setRefreshToken } from "@/lib/secure-store";
import { useAuthStore } from "@/stores/auth-store";

/**
 * OAuthコールバック画面
 *
 * ソーシャルログイン後のディープリンク `techclip://auth/callback?token=...` を処理する。
 * トークンをセキュアストレージに保存し、セッションを確立してホーム画面へ遷移する。
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string; refresh_token?: string; error?: string }>();
  const router = useRouter();
  const checkSession = useAuthStore((s) => s.checkSession);
  const { t } = useTranslation();

  useEffect(() => {
    handleCallback();
  }, [handleCallback]);

  async function handleCallback() {
    if (params.error) {
      router.replace("/(auth)/login");
      return;
    }

    if (!params.token) {
      router.replace("/(auth)/login");
      return;
    }

    await setAuthToken(params.token);
    if (params.refresh_token) {
      await setRefreshToken(params.refresh_token);
    }

    await checkSession();
    router.replace("/(tabs)");
  }

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" />
      <Text className="mt-4 text-text-muted">{t("auth.signingIn")}</Text>
    </View>
  );
}
