import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useAuthStore } from "@/stores/auth-store";

/** OAuthコールバック状態 */
type CallbackState = "loading" | "error";

/** URLにerrorパラメータが存在するか確認する */
function hasErrorParam(queryParams: Record<string, string | string[]>): boolean {
  return typeof queryParams.error === "string" && queryParams.error.length > 0;
}

/** URLからcodeパラメータが存在するか確認する */
function hasCodeParam(queryParams: Record<string, string | string[]>): boolean {
  return typeof queryParams.code === "string" && queryParams.code.length > 0;
}

/**
 * OAuthコード受け取り型コールバック画面
 * ソーシャルログイン後にdeep linkで起動されるコールバックを処理する
 *
 * @remarks
 * `auth/callback` との違い:
 * - こちら（(auth)/oauth-callback）はOAuthプロバイダーからcodeを受け取り、
 *   Better Authがサーバーサイドでセッションを確立するフロー
 * - `auth/callback` はAPIサーバーが発行したトークンをクエリパラメータで受け取るフロー
 *
 * checkSession() はコールバックURL受信後に呼び出す。
 * Better Auth はコールバック時にサーバーサイドでセッションCookieを設定済みのため、
 * checkSession() でそのセッションを確認してストアに反映する。
 * トークンの手動保存は不要。
 */
export default function OAuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const checkSession = useAuthStore((s) => s.checkSession);
  const url = Linking.useURL();

  const [state, setState] = useState<CallbackState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!url) {
      return;
    }

    const parsed = Linking.parse(url);
    const queryParams = (parsed.queryParams ?? {}) as Record<string, string | string[]>;

    if (hasErrorParam(queryParams)) {
      setErrorMessage(t("auth.oauthCallback.errorSocialLogin"));
      setState("error");
      return;
    }

    if (!hasCodeParam(queryParams)) {
      setErrorMessage(t("auth.oauthCallback.errorNoCode"));
      setState("error");
      return;
    }

    let cancelled = false;
    checkSession()
      .then(() => {
        if (cancelled) return;
        router.replace("/(tabs)");
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMessage(t("auth.oauthCallback.errorCheckSession"));
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [url, checkSession, router, t]);

  if (state === "error") {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text
          className="mb-6 text-center text-base text-error"
          testID="oauth-callback-error"
          accessibilityRole="alert"
        >
          {errorMessage}
        </Text>
        <Pressable
          onPress={() => router.replace("/(auth)/login")}
          className="rounded-lg bg-primary px-6 py-3"
          testID="oauth-callback-back-button"
          accessibilityRole="button"
          accessibilityLabel={t("auth.oauthCallback.backToLogin")}
        >
          <Text className="text-base font-semibold text-white">
            {t("auth.oauthCallback.backToLogin")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator
        size="large"
        testID="oauth-callback-loading"
        accessibilityLabel={t("auth.oauthCallback.processingLabel")}
      />
      <Text className="mt-4 text-sm text-text-muted">{t("auth.oauthCallback.processing")}</Text>
    </View>
  );
}
