import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useAuthStore } from "@/stores/auth-store";

/** OAuthコールバック状態 */
type CallbackState = "loading" | "error" | "success";

/** URLからクエリパラメータを安全に取得する型ガード */
function hasErrorParam(queryParams: Record<string, string | string[]>): boolean {
  return typeof queryParams.error === "string" && queryParams.error.length > 0;
}

/** URLからcodeパラメータが存在するか確認する */
function hasCodeParam(queryParams: Record<string, string | string[]>): boolean {
  return typeof queryParams.code === "string" && queryParams.code.length > 0;
}

/**
 * OAuthコールバック画面
 * ソーシャルログイン後にdeep linkで起動されるコールバックを処理する
 */
export default function OAuthCallbackScreen() {
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
      setErrorMessage("ソーシャルログインに失敗しました。もう一度お試しください。");
      setState("error");
      return;
    }

    if (!hasCodeParam(queryParams)) {
      setErrorMessage("認証コードが見つかりません。もう一度お試しください。");
      setState("error");
      return;
    }

    checkSession()
      .then(() => {
        setState("success");
        router.replace("/(tabs)");
      })
      .catch(() => {
        setErrorMessage("認証の確認に失敗しました。もう一度お試しください。");
        setState("error");
      });
  }, [url, checkSession, router]);

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
          accessibilityLabel="ログイン画面に戻る"
        >
          <Text className="text-base font-semibold text-white">ログイン画面に戻る</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator
        size="large"
        testID="oauth-callback-loading"
        accessibilityLabel="認証処理中"
      />
      <Text className="mt-4 text-sm text-text-muted">認証処理中...</Text>
    </View>
  );
}
