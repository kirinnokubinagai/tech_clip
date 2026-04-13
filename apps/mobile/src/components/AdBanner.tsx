import { View } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { useSubscription } from "@/hooks/use-subscription";

/** AdMobバナー広告のユニットID（環境変数未設定時はテスト用IDにフォールバック） */
const AD_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ?? TestIds.ADAPTIVE_BANNER;

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
  const { isSubscribed } = useSubscription();

  if (isSubscribed) {
    return null;
  }

  return (
    <View testID={testID}>
      <BannerAd unitId={AD_UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}
