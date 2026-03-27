import { useCallback, useEffect, useState } from "react";
import type { PurchasesPackage } from "react-native-purchases";

import { checkSubscriptionStatus, purchasePackage, restorePurchases } from "@/lib/revenueCat";
import type { SubscriptionStatus } from "@/lib/revenueCat";

/** サブスクリプション状態hookの戻り値の型 */
type UseSubscriptionResult = {
  /** プレミアムサブスクリプションがアクティブかどうか */
  isSubscribed: boolean;
  /** 現在のプラン識別子。未加入の場合はnull */
  currentPlan: string | null;
  /** ローディング中かどうか */
  isLoading: boolean;
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

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const result = await checkSubscriptionStatus();
        if (isMounted) {
          setStatus(result);
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
    try {
      const result = await purchasePackage(pkg);
      if (result !== null) {
        setStatus(result);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restore = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const result = await restorePurchases();
      setStatus(result);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSubscribed: status.isSubscribed,
    currentPlan: status.currentPlan,
    isLoading,
    purchase,
    restore,
  };
}
