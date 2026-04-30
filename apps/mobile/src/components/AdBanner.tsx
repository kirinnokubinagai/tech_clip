import { useEffect, useState } from "react";
import { View } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

import { apiFetch } from "@/lib/api";

/** AdMobバナー広告のユニットID（環境変数未設定時はテスト用IDにフォールバック） */
const AD_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? TestIds.ADAPTIVE_BANNER;

/** サブスクリプション状態APIのパス */
const SUBSCRIPTION_STATUS_PATH = "/api/subscription/status";

type AdBannerProps = {
  /** カスタムtestID */
  testID?: string;
};

type SubscriptionStatusResponse = {
  success: true;
  data: { isPremium: boolean };
};

/**
 * AdMobバナー広告コンポーネント
 * プレミアムユーザーには非表示
 * サーバーサイドの isPremium を優先的に使用する（RevenueCat が E2E 環境で動作しないため）
 *
 * @param props - コンポーネントプロパティ
 * @returns バナー広告。プレミアムユーザーの場合はnull
 */
export function AdBanner({ testID = "ad-banner-container" }: AdBannerProps) {
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    let isMounted = true;
    apiFetch<SubscriptionStatusResponse>(SUBSCRIPTION_STATUS_PATH)
      .then((res) => {
        if (isMounted) {
          setIsPremium(res.data.isPremium);
        }
      })
      .catch(() => {
        // APIエラー時はデフォルト(false)のまま広告を表示
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (isPremium) {
    return null;
  }

  return (
    <View testID={testID}>
      <BannerAd unitId={AD_UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}
