import { Platform } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import Purchases from "react-native-purchases";

/** RevenueCat プレミアムエンタイトルメント識別子 */
const PREMIUM_ENTITLEMENT_ID = "premium";

/** サブスクリプション状態の型定義 */
export type SubscriptionStatus = {
  /** プレミアムサブスクリプションがアクティブかどうか */
  isSubscribed: boolean;
  /** 現在のプラン識別子。未加入の場合はnull */
  currentPlan: string | null;
};

/**
 * プラットフォームごとのRevenueCat APIキーを取得する
 *
 * @returns プラットフォームに対応するAPIキー
 */
function requireEnvKey(name: string, value: string | undefined): string {
  if (!value || value === "undefined") {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

function getApiKey(): string {
  if (Platform.OS === "ios") {
    return requireEnvKey(
      "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    );
  }
  return requireEnvKey(
    "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  );
}

/**
 * CustomerInfoからサブスクリプション状態を抽出する
 *
 * @param customerInfo - RevenueCatのCustomerInfo
 * @returns サブスクリプション状態
 */
function extractSubscriptionStatus(customerInfo: {
  entitlements: { active: Record<string, { isActive: boolean; productIdentifier: string }> };
}): SubscriptionStatus {
  const premiumEntitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
  if (!premiumEntitlement?.isActive) {
    return { isSubscribed: false, currentPlan: null };
  }
  return {
    isSubscribed: true,
    currentPlan: premiumEntitlement.productIdentifier,
  };
}

/**
 * RevenueCat SDKを初期化する
 * プラットフォームごとに適切なAPIキーを設定する
 *
 * @throws RevenueCat設定に失敗した場合
 */
export async function configureRevenueCat(): Promise<void> {
  const apiKey = getApiKey();
  try {
    Purchases.setDebugLogsEnabled(__DEV__);
    await Purchases.configure({ apiKey });
  } catch {
    throw new Error("RevenueCat設定に失敗しました");
  }
}

/**
 * 現在のサブスクリプション状態を取得する
 *
 * @returns サブスクリプション状態
 * @throws サブスクリプション状態の取得に失敗した場合
 */
export async function checkSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return extractSubscriptionStatus(customerInfo);
  } catch {
    throw new Error("サブスクリプション状態の取得に失敗しました");
  }
}

/**
 * パッケージを購入する
 * ユーザーがキャンセルした場合はnullを返す
 *
 * @param pkg - 購入するパッケージ
 * @returns 購入後のサブスクリプション状態。キャンセルの場合はnull
 * @throws 購入処理に失敗した場合（キャンセル除く）
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<SubscriptionStatus | null> {
  try {
    const result = await Purchases.purchasePackage(pkg);
    return extractSubscriptionStatus(result.customerInfo);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "userCancelled" in error &&
      (error as { userCancelled: boolean }).userCancelled
    ) {
      return null;
    }
    throw new Error("購入処理に失敗しました");
  }
}

/**
 * 過去の購入を復元する
 *
 * @returns 復元後のサブスクリプション状態
 * @throws 購入の復元に失敗した場合
 */
export async function restorePurchases(): Promise<SubscriptionStatus> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return extractSubscriptionStatus(customerInfo);
  } catch {
    throw new Error("購入の復元に失敗しました");
  }
}

/**
 * 利用可能なオファリングのパッケージ一覧を取得する
 *
 * @returns 現在のオファリングのパッケージ一覧。current がない場合は空配列
 * @throws オファリング取得に失敗した場合
 */
export async function getOfferings(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    throw new Error("オファリングの取得に失敗しました");
  }
}
