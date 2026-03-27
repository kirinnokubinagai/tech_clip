import { router } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

/** URLバリデーション正規表現 */
const URL_PATTERN = /^https?:\/\/.+/;

/**
 * Share Intent 受信画面
 *
 * OS共有シートからTechClipが選択されたとき起動される。
 * 受け取ったURLをバリデーションしてSave画面にプリセットする。
 */
export default function ShareIntentScreen() {
  const { shareIntent, isReady, error, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (!isReady) return;
    if (!shareIntent) return;

    const webUrl = shareIntent.webUrl;
    if (!webUrl || !URL_PATTERN.test(webUrl)) return;

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
        <ActivityIndicator size="large" accessibilityLabel="読み込み中" />
        <Text className="sr-only">読み込み中</Text>
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
          共有データの読み取りに失敗しました
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="rounded-lg bg-primary px-6 py-3"
          accessibilityRole="button"
          accessibilityLabel="閉じる"
        >
          <Text className="text-white font-medium">閉じる</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className="flex-1 items-center justify-center bg-background"
      accessibilityLabel="share-intent-loading"
    >
      <ActivityIndicator size="large" accessibilityLabel="読み込み中" />
    </View>
  );
}
