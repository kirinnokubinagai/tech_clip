import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useSubscription } from "../use-subscription";

/** revenueCat モック */
jest.mock("@/lib/revenueCat", () => ({
  checkSubscriptionStatus: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
}));

const revenueCat = require("@/lib/revenueCat") as {
  checkSubscriptionStatus: jest.Mock;
  purchasePackage: jest.Mock;
  restorePurchases: jest.Mock;
};

/** アクティブなサブスクリプション状態のモック */
const mockActiveStatus = {
  isSubscribed: true,
  currentPlan: "monthly_premium",
};

/** 非アクティブなサブスクリプション状態のモック */
const mockInactiveStatus = {
  isSubscribed: false,
  currentPlan: null,
};

/** テスト用パッケージモック */
const mockPackage = {
  identifier: "monthly_premium",
  packageType: "MONTHLY",
};

describe("useSubscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("初期状態", () => {
    it("初期状態でisLoadingがtrueであること", async () => {
      // Arrange - 永続的にpendingのPromiseでローディング状態を維持
      revenueCat.checkSubscriptionStatus.mockReturnValue(new Promise(() => {}));

      // Act
      const { result } = await renderHook(() => useSubscription());

      // Assert
      expect(result.current.isLoading).toBe(true);
    });

    it("サブスクリプション状態取得後にisSubscribedが設定されること", async () => {
      // Arrange
      revenueCat.checkSubscriptionStatus.mockResolvedValue(mockActiveStatus);

      // Act
      const { result } = await renderHook(() => useSubscription());

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.isSubscribed).toBe(true);
      expect(result.current.currentPlan).toBe("monthly_premium");
    });

    it("サブスクリプションがない場合にisSubscribedがfalseになること", async () => {
      // Arrange
      revenueCat.checkSubscriptionStatus.mockResolvedValue(mockInactiveStatus);

      // Act
      const { result } = await renderHook(() => useSubscription());

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.isSubscribed).toBe(false);
      expect(result.current.currentPlan).toBeNull();
    });

    it("サブスクリプション状態取得に失敗した場合にerrorが設定されること", async () => {
      // Arrange
      revenueCat.checkSubscriptionStatus.mockRejectedValue(
        new Error("サブスクリプション状態の取得に失敗しました"),
      );

      // Act
      const { result } = await renderHook(() => useSubscription());

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe("サブスクリプション状態の取得に失敗しました");
    });
  });

  describe("purchase", () => {
    it("購入が成功するとサブスクリプション状態が更新されること", async () => {
      // Arrange
      revenueCat.checkSubscriptionStatus.mockResolvedValue(mockInactiveStatus);
      revenueCat.purchasePackage.mockResolvedValue(mockActiveStatus);

      const { result } = await renderHook(() => useSubscription());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.purchase(mockPackage as never);
      });

      // Assert
      expect(result.current.isSubscribed).toBe(true);
      expect(result.current.currentPlan).toBe("monthly_premium");
    });

    it("ユーザーがキャンセルした場合に状態が変わらないこと", async () => {
      // Arrange
      revenueCat.checkSubscriptionStatus.mockResolvedValue(mockInactiveStatus);
      revenueCat.purchasePackage.mockResolvedValue(null);

      const { result } = await renderHook(() => useSubscription());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.purchase(mockPackage as never);
      });

      // Assert
      expect(result.current.isSubscribed).toBe(false);
    });

    it("購入中はisLoadingがtrueになること", async () => {
      // Arrange
      revenueCat.checkSubscriptionStatus.mockResolvedValue(mockInactiveStatus);
      let resolvePurchase!: (value: typeof mockActiveStatus) => void;
      revenueCat.purchasePackage.mockReturnValue(
        new Promise<typeof mockActiveStatus>((resolve) => {
          resolvePurchase = resolve;
        }),
      );

      const { result } = await renderHook(() => useSubscription());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        result.current.purchase(mockPackage as never);
      });

      // Assert
      expect(result.current.isLoading).toBe(true);

      // Cleanup
      await act(async () => {
        resolvePurchase(mockActiveStatus);
      });
    });

    it("購入が失敗した場合にerrorが設定されること", async () => {
      // Arrange
      revenueCat.checkSubscriptionStatus.mockResolvedValue(mockInactiveStatus);
      revenueCat.purchasePackage.mockRejectedValue(new Error("購入処理に失敗しました"));

      const { result } = await renderHook(() => useSubscription());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.purchase(mockPackage as never);
      });

      // Assert
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe("購入処理に失敗しました");
    });
  });

  describe("restore", () => {
    it("購入の復元が成功するとサブスクリプション状態が更新されること", async () => {
      // Arrange
      revenueCat.checkSubscriptionStatus.mockResolvedValue(mockInactiveStatus);
      revenueCat.restorePurchases.mockResolvedValue(mockActiveStatus);

      const { result } = await renderHook(() => useSubscription());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.restore();
      });

      // Assert
      expect(result.current.isSubscribed).toBe(true);
      expect(result.current.currentPlan).toBe("monthly_premium");
      expect(revenueCat.restorePurchases).toHaveBeenCalledTimes(1);
    });

    it("復元中はisLoadingがtrueになること", async () => {
      // Arrange
      revenueCat.checkSubscriptionStatus.mockResolvedValue(mockInactiveStatus);
      let resolveRestore!: (value: typeof mockActiveStatus) => void;
      revenueCat.restorePurchases.mockReturnValue(
        new Promise<typeof mockActiveStatus>((resolve) => {
          resolveRestore = resolve;
        }),
      );

      const { result } = await renderHook(() => useSubscription());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        result.current.restore();
      });

      // Assert
      expect(result.current.isLoading).toBe(true);

      // Cleanup
      await act(async () => {
        resolveRestore(mockActiveStatus);
      });
    });

    it("復元が失敗した場合にerrorが設定されること", async () => {
      // Arrange
      revenueCat.checkSubscriptionStatus.mockResolvedValue(mockInactiveStatus);
      revenueCat.restorePurchases.mockRejectedValue(new Error("購入の復元に失敗しました"));

      const { result } = await renderHook(() => useSubscription());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.restore();
      });

      // Assert
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe("購入の復元に失敗しました");
    });
  });
});
