import { AdEventType, InterstitialAd, TestIds } from "react-native-google-mobile-ads";

/** Interstitial 広告表示の記事閲覧回数閾値 */
const INTERSTITIAL_VIEW_INTERVAL = 4;

/** AdMob Interstitial 広告ユニットID（環境変数未設定時はテスト用IDにフォールバック） */
const AD_UNIT_ID = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? TestIds.INTERSTITIAL;

let articleViewCount = 0;
let interstitialAd: InterstitialAd | null = null;
let isAdLoaded = false;

/**
 * Interstitial 広告をプリロードする
 */
function preloadInterstitial(): void {
  interstitialAd = InterstitialAd.createForAdRequest(AD_UNIT_ID);

  interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    isAdLoaded = true;
  });

  interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    isAdLoaded = false;
    preloadInterstitial();
  });

  interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
    isAdLoaded = false;
  });

  interstitialAd.load();
}

/**
 * 記事閲覧カウンタをインクリメントし、閾値に達したら Interstitial 広告を表示する
 *
 * @param isSubscribed - プレミアムユーザーの場合は広告をスキップ
 */
export function incrementArticleView(isSubscribed: boolean): void {
  if (isSubscribed) {
    return;
  }

  articleViewCount += 1;

  if (articleViewCount % INTERSTITIAL_VIEW_INTERVAL === 0 && isAdLoaded && interstitialAd) {
    void interstitialAd.show();
  }
}

preloadInterstitial();
