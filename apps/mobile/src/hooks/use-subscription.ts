import { useCallback, useEffect, useState } from "react";
import type { PurchasesPackage } from "react-native-purchases";
import type { SubscriptionStatus } from "@/lib/revenueCat";
import { checkSubscriptionStatus, purchasePackage, restorePurchases } from "@/lib/revenueCat";

/** サブスクリプション状態hookの戻り値の型 */
type UseSubscriptionResult = {
  /** プレミアムサブスクリプションがアクティブかどうか */
  isSubscribed: boolean;
  /** 現在のプラン識別子。未加入の場合はnull */
  currentPlan: string | null;
  /** ローディング中かどうか */
  isLoading: boolean;
  /** 最後に発生したエラー。エラーがない場合はnull */
  error: Error | null;
  /**
   * パッケージを購入する
   * @param pkg - 購入するパッケージ
   */
  purchase: (pkg: PurchasesPackage) => Promise<void>;
  /** 過去の購入を復元する */
  restore: () => Promise<void>;
};

/**
 * RevenueCatサブスクリプション状態を管理するhook
 *
 * @returns サブスクリプション状態と操作関数
 */
export function useSubscription(): UseSubscriptionResult {
  const [status, setStatus] = useState<SubscriptionStatus>({
    isSubscribed: false,
    currentPlan: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const result = await checkSubscriptionStatus();
        if (isMounted) {
          setStatus(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err : new Error("サブスクリプション状態の取得に失敗しました"),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await purchasePackage(pkg);
      if (result !== null) {
        setStatus(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("購入処理に失敗しました"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restore = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await restorePurchases();
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("購入の復元に失敗しました"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSubscribed: status.isSubscribed,
    currentPlan: status.currentPlan,
    isLoading,
    error,
    purchase,
    restore,
  };
}
