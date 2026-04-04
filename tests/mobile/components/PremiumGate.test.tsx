jest.mock("react-native-svg", () => {
  const mockReact = require("react");
  const { View } = require("react-native");
  return {
    Svg: (props: object) => mockReact.createElement(View, props),
    Path: (props: object) => mockReact.createElement(View, props),
    G: (props: object) => mockReact.createElement(View, props),
    Circle: (props: object) => mockReact.createElement(View, props),
    Rect: (props: object) => mockReact.createElement(View, props),
    Line: (props: object) => mockReact.createElement(View, props),
    Polyline: (props: object) => mockReact.createElement(View, props),
    default: (props: object) => mockReact.createElement(View, props),
  };
});

jest.mock("lucide-react-native", () => {
  const mockReact = require("react");
  const { View } = require("react-native");
  const mockIcon = (props: object) => mockReact.createElement(View, props);
  return {
    Check: mockIcon,
    X: mockIcon,
  };
});

import { PremiumGate } from "@mobile/components/PremiumGate";
import { fireEvent, render } from "@testing-library/react-native";

/** テスト用のデフォルトprops */
const BASE_PROPS = {
  currentUsage: 5,
  maxUsage: 5,
  features: ["AI要約（無制限）", "AI翻訳（無制限）", "優先サポート"],
  onPurchase: jest.fn(),
  onClose: jest.fn(),
};

describe("PremiumGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("レンダリング", () => {
    it("プレミアムプランのタイトルが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByText("プレミアムプラン")).toBeDefined();
    });

    it("現在の使用回数と上限が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByText("5 / 5")).toBeDefined();
    });

    it("プレミアム機能一覧が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByText("AI要約（無制限）")).toBeDefined();
      expect(getByText("AI翻訳（無制限）")).toBeDefined();
      expect(getByText("優先サポート")).toBeDefined();
    });

    it("購入ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByLabelText } = await render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByLabelText("プレミアムプランを購入する")).toBeDefined();
    });

    it("閉じるボタンが表示されること", async () => {
      // Arrange & Act
      const { getByLabelText } = await render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByLabelText("閉じる")).toBeDefined();
    });

    it("featuresが空配列の場合も正常にレンダリングできること", async () => {
      // Arrange
      const props = { ...BASE_PROPS, features: [] };

      // Act
      const { getByText } = await render(<PremiumGate {...props} />);

      // Assert
      expect(getByText("プレミアムプラン")).toBeDefined();
    });

    it("上限超過メッセージが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByText("無料プランの上限に達しました")).toBeDefined();
    });
  });

  describe("使用量表示", () => {
    it("currentUsageが0の場合も正常に表示されること", async () => {
      // Arrange
      const props = { ...BASE_PROPS, currentUsage: 0, maxUsage: 10 };

      // Act
      const { getByText } = await render(<PremiumGate {...props} />);

      // Assert
      expect(getByText("0 / 10")).toBeDefined();
    });

    it("currentUsageとmaxUsageが同じ値の場合に正しく表示されること", async () => {
      // Arrange
      const props = { ...BASE_PROPS, currentUsage: 3, maxUsage: 3 };

      // Act
      const { getByText } = await render(<PremiumGate {...props} />);

      // Assert
      expect(getByText("3 / 3")).toBeDefined();
    });
  });

  describe("インタラクション", () => {
    it("購入ボタンタップ時にonPurchaseが呼ばれること", async () => {
      // Arrange
      const onPurchase = jest.fn();
      const { getByLabelText } = await render(
        <PremiumGate {...BASE_PROPS} onPurchase={onPurchase} />,
      );

      // Act
      await fireEvent.press(getByLabelText("プレミアムプランを購入する"));

      // Assert
      expect(onPurchase).toHaveBeenCalledTimes(1);
    });

    it("閉じるボタンタップ時にonCloseが呼ばれること", async () => {
      // Arrange
      const onClose = jest.fn();
      const { getByLabelText } = await render(<PremiumGate {...BASE_PROPS} onClose={onClose} />);

      // Act
      await fireEvent.press(getByLabelText("閉じる"));

      // Assert
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("アクセシビリティ", () => {
    it("購入ボタンにaccessibilityLabelが設定されていること", async () => {
      // Arrange & Act
      const { getByLabelText } = await render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByLabelText("プレミアムプランを購入する")).toBeDefined();
    });

    it("閉じるボタンにaccessibilityLabelが設定されていること", async () => {
      // Arrange & Act
      const { getByLabelText } = await render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByLabelText("閉じる")).toBeDefined();
    });
  });
});
