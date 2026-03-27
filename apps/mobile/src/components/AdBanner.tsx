import { View } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

import { useSubscriptionStore } from "@/stores";

/** AdMobバナー広告のユニットID（テスト用） */
const AD_UNIT_ID = TestIds.ADAPTIVE_BANNER;

type AdBannerProps = {
  /** カスタムtestID */
  testID?: string;
};

/**
 * AdMobバナー広告コンポーネント
 * プレミアムユーザーには非表示
 *
 * @param props - コンポーネントプロパティ
 * @returns バナー広告。プレミアムユーザーの場合はnull
 */
export function AdBanner({ testID = "ad-banner-container" }: AdBannerProps) {
  const isPremium = useSubscriptionStore((state) => state.isPremium);

  if (isPremium) {
    return null;
  }

  return (
    <View testID={testID}>
      <BannerAd unitId={AD_UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}
