import {
  checkSubscriptionStatus,
  configureRevenueCat,
  purchasePackage,
  restorePurchases,
} from "./revenueCat";

/** react-native-purchases モック */
jest.mock("react-native-purchases", () => ({
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    setDebugLogsEnabled: jest.fn(),
  },
  __esModule: true,
}));

/** モック関数へのアクセス用 */
const Purchases = require("react-native-purchases").default as {
  configure: jest.Mock;
  getCustomerInfo: jest.Mock;
  purchasePackage: jest.Mock;
  restorePurchases: jest.Mock;
  setDebugLogsEnabled: jest.Mock;
};

/** プレミアムエンタイトルメントがアクティブなCustomerInfoのモック */
const mockActiveCustomerInfo = {
  entitlements: {
    active: {
      premium: {
        isActive: true,
        productIdentifier: "monthly_premium",
        expirationDate: "2026-12-31",
      },
    },
  },
};

/** プレミアムエンタイトルメントが非アクティブなCustomerInfoのモック */
const mockInactiveCustomerInfo = {
  entitlements: {
    active: {},
  },
};

describe("configureRevenueCat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = "test-ios-key";
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = "test-android-key";
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = undefined;
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = undefined;
  });

  it("RevenueCat SDKを設定できること", async () => {
    // Arrange
    Purchases.configure.mockResolvedValue(undefined);

    // Act
    await configureRevenueCat();

    // Assert
    expect(Purchases.setDebugLogsEnabled).toHaveBeenCalledTimes(1);
    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect(Purchases.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: expect.any(String),
      }),
    );
  });

  it("APIキーが未設定の場合にエラーをスローすること", async () => {
    // Arrange
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = undefined;
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = undefined;

    // Act & Assert
    await expect(configureRevenueCat()).rejects.toThrow("が設定されていません");
  });

  it("設定が失敗した場合にエラーをスローすること", async () => {
    // Arrange
    Purchases.configure.mockRejectedValue(new Error("設定エラー"));

    // Act & Assert
    await expect(configureRevenueCat()).rejects.toThrow("RevenueCat設定に失敗しました");
  });
});

describe("checkSubscriptionStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("プレミアムサブスクリプションがアクティブな場合にtrueを返すこと", async () => {
    // Arrange
    Purchases.getCustomerInfo.mockResolvedValue(mockActiveCustomerInfo);

    // Act
    const result = await checkSubscriptionStatus();

    // Assert
    expect(result.isSubscribed).toBe(true);
    expect(result.currentPlan).toBe("monthly_premium");
    expect(Purchases.getCustomerInfo).toHaveBeenCalledTimes(1);
  });

  it("プレミアムサブスクリプションが非アクティブな場合にfalseを返すこと", async () => {
    // Arrange
    Purchases.getCustomerInfo.mockResolvedValue(mockInactiveCustomerInfo);

    // Act
    const result = await checkSubscriptionStatus();

    // Assert
    expect(result.isSubscribed).toBe(false);
    expect(result.currentPlan).toBeNull();
  });

  it("CustomerInfo取得が失敗した場合にエラーをスローすること", async () => {
    // Arrange
    Purchases.getCustomerInfo.mockRejectedValue(new Error("ネットワークエラー"));

    // Act & Assert
    await expect(checkSubscriptionStatus()).rejects.toThrow(
      "サブスクリプション状態の取得に失敗しました",
    );
  });
});

describe("purchasePackage", () => {
  /** テスト用パッケージモック */
  const mockPackage = {
    identifier: "monthly_premium",
    packageType: "MONTHLY",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("購入が成功してサブスクリプションがアクティブになること", async () => {
    // Arrange
    Purchases.purchasePackage.mockResolvedValue({
      customerInfo: mockActiveCustomerInfo,
    });

    // Act
    const result = await purchasePackage(mockPackage as never);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.isSubscribed).toBe(true);
    expect(result?.currentPlan).toBe("monthly_premium");
    expect(Purchases.purchasePackage).toHaveBeenCalledWith(mockPackage);
  });

  it("ユーザーがキャンセルした場合にnullを返すこと", async () => {
    // Arrange
    const cancelError = Object.assign(new Error("User cancelled"), {
      userCancelled: true,
    });
    Purchases.purchasePackage.mockRejectedValue(cancelError);

    // Act
    const result = await purchasePackage(mockPackage as never);

    // Assert
    expect(result).toBeNull();
  });

  it("購入が失敗した場合にエラーをスローすること", async () => {
    // Arrange
    const purchaseError = Object.assign(new Error("決済エラー"), {
      userCancelled: false,
    });
    Purchases.purchasePackage.mockRejectedValue(purchaseError);

    // Act & Assert
    await expect(purchasePackage(mockPackage as never)).rejects.toThrow("購入処理に失敗しました");
  });
});

describe("restorePurchases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("購入の復元が成功してサブスクリプション状態を返すこと", async () => {
    // Arrange
    Purchases.restorePurchases.mockResolvedValue(mockActiveCustomerInfo);

    // Act
    const result = await restorePurchases();

    // Assert
    expect(result.isSubscribed).toBe(true);
    expect(result.currentPlan).toBe("monthly_premium");
    expect(Purchases.restorePurchases).toHaveBeenCalledTimes(1);
  });

  it("復元後にサブスクリプションがない場合にfalseを返すこと", async () => {
    // Arrange
    Purchases.restorePurchases.mockResolvedValue(mockInactiveCustomerInfo);

    // Act
    const result = await restorePurchases();

    // Assert
    expect(result.isSubscribed).toBe(false);
    expect(result.currentPlan).toBeNull();
  });

  it("復元が失敗した場合にエラーをスローすること", async () => {
    // Arrange
    Purchases.restorePurchases.mockRejectedValue(new Error("復元エラー"));

    // Act & Assert
    await expect(restorePurchases()).rejects.toThrow("購入の復元に失敗しました");
  });
});
