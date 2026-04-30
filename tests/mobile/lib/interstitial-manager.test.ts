/**
 * interstitial-manager のテスト
 *
 * react-native-google-mobile-ads は __mocks__ でスタブ化されているため、
 * 実際の広告 SDK を呼ばずにロジックをテストする。
 */

// NOTE: モジュールレベルの副作用（preloadInterstitial の初回呼び出し）は
// jest.isolateModules で分離して再評価する。

const mockShow = jest.fn().mockResolvedValue(undefined);
const mockLoad = jest.fn();
const mockAddAdEventListener = jest.fn();

jest.mock("react-native-google-mobile-ads", () => ({
  AdEventType: {
    LOADED: "loaded",
    CLOSED: "closed",
    ERROR: "error",
  },
  TestIds: {
    INTERSTITIAL: "ca-app-pub-3940256099942544/1033173712",
  },
  InterstitialAd: {
    createForAdRequest: jest.fn(() => ({
      load: mockLoad,
      show: mockShow,
      addAdEventListener: mockAddAdEventListener,
    })),
  },
}));

describe("incrementArticleView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("isSubscribed=trueのときに広告表示がスキップされること", () => {
    // Arrange
    jest.isolateModules(() => {
      // Act
      const { incrementArticleView } = require("@mobile/lib/interstitial-manager");

      for (let i = 0; i < 4; i++) {
        incrementArticleView(true);
      }

      // Assert
      expect(mockShow).not.toHaveBeenCalled();
    });
  });

  it("isSubscribed=falseのとき閾値（4回）未満では広告表示しないこと", () => {
    // Arrange
    jest.isolateModules(() => {
      // Act
      const { incrementArticleView } = require("@mobile/lib/interstitial-manager");

      for (let i = 0; i < 3; i++) {
        incrementArticleView(false);
      }

      // Assert
      expect(mockShow).not.toHaveBeenCalled();
    });
  });

  it("isSubscribed=falseで4回目のビューに達したとき、広告がロード済みなら表示を試みること", () => {
    // Arrange
    jest.isolateModules(() => {
      const { AdEventType, InterstitialAd } = require("react-native-google-mobile-ads");

      // addAdEventListener が呼ばれたときにLOADEDコールバックを即座に発火させる
      mockAddAdEventListener.mockImplementation((event: string, cb: () => void) => {
        if (event === AdEventType.LOADED) {
          cb();
        }
      });
      InterstitialAd.createForAdRequest.mockReturnValue({
        load: mockLoad,
        show: mockShow,
        addAdEventListener: mockAddAdEventListener,
      });

      // Act
      const { incrementArticleView } = require("@mobile/lib/interstitial-manager");

      for (let i = 0; i < 4; i++) {
        incrementArticleView(false);
      }

      // Assert - isAdLoaded=true かつ 4回目なので show が呼ばれる
      expect(mockShow).toHaveBeenCalledTimes(1);
    });
  });

  it("広告がロードされていないとき4回目でも表示しないこと", () => {
    // Arrange
    jest.isolateModules(() => {
      // addAdEventListener はLOADED発火なし（デフォルトモック）
      mockAddAdEventListener.mockImplementation(() => {});

      // Act
      const { incrementArticleView } = require("@mobile/lib/interstitial-manager");

      for (let i = 0; i < 4; i++) {
        incrementArticleView(false);
      }

      // Assert - isAdLoaded=false のため show は呼ばれない
      expect(mockShow).not.toHaveBeenCalled();
    });
  });
});
