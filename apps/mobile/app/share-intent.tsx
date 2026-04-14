import { router } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

/**
 * URLがhttp/httpsスキームを持つ有効なURLかを検証する
 */
function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Share Intent 受信画面
 *
 * OS共有シートからTechClipが選択されたとき起動される。
 * 受け取ったURLをバリデーションしてSave画面にプリセットする。
 */
export default function ShareIntentScreen() {
  const { t } = useTranslation();
  const { shareIntent, isReady, error, resetShareIntent } = useShareIntent();
  /** 二重遷移を防ぐガード */
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!isReady) return;
    if (!shareIntent) return;
    if (hasNavigated.current) return;

    const webUrl = shareIntent.webUrl;
    if (!webUrl || !isValidHttpUrl(webUrl)) return;

    hasNavigated.current = true;
    resetShareIntent();
    router.push({
      pathname: "/article/save",
      params: { url: webUrl },
    });
  }, [isReady, shareIntent, resetShareIntent]);

  if (!isReady) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        accessibilityLabel="share-intent-loading"
      >
        <ActivityIndicator size="large" accessibilityLabel={t("shareIntent.loading")} />
        <Text className="sr-only">{t("shareIntent.loading")}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background px-6"
        accessibilityLabel="share-intent-error"
      >
        <Text
          className="text-text text-base text-center mb-6"
          accessibilityLabel="share-intent-error-message"
        >
          {t("shareIntent.error")}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="rounded-lg bg-primary px-6 py-3"
          accessibilityRole="button"
          accessibilityLabel={t("shareIntent.close")}
        >
          <Text className="text-white font-medium">{t("shareIntent.close")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className="flex-1 items-center justify-center bg-background px-6"
      accessibilityLabel="share-intent-not-found"
    >
      <Text
        className="text-text text-base text-center mb-6"
        accessibilityLabel="share-intent-not-found-message"
      >
        {t("shareIntent.notFound")}
      </Text>
      <Pressable
        onPress={() => router.back()}
        className="rounded-lg bg-primary px-6 py-3"
        accessibilityRole="button"
        accessibilityLabel={t("shareIntent.close")}
      >
        <Text className="text-white font-medium">{t("shareIntent.close")}</Text>
      </Pressable>
    </View>
  );
}
