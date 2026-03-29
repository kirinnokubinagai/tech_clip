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

import { fireEvent, render } from "@testing-library/react-native";
import type React from "react";
import { Text } from "react-native";

import { PremiumGate } from "../../src/components/PremiumGate";

/** テスト用のデフォルトprops */
const BASE_PROPS = {
  currentUsage: 5,
  maxUsage: 5,
  features: ["AI要約（無制限）", "AI翻訳（無制限）", "優先サポート"],
  onPurchase: jest.fn(),
  onClose: jest.fn(),
};

/**
 * レンダリングされたコンポーネントからTextノードのchildren一覧を取得する
 */
function getAllTextContent(
  unsafeGetAllByType: <P>(
    type: React.ComponentType<P>,
  ) => Array<{ props: Record<string, unknown> }>,
): string[] {
  const textNodes = unsafeGetAllByType(Text);
  return textNodes
    .map((node) => {
      const children = node.props.children;
      if (typeof children === "string") return children;
      if (typeof children === "number") return String(children);
      return null;
    })
    .filter((text): text is string => text !== null);
}

describe("PremiumGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("レンダリング", () => {
    it("プレミアムプランのタイトルが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<PremiumGate {...BASE_PROPS} />);
      const texts = getAllTextContent(UNSAFE_getAllByType);

      // Assert
      expect(texts.some((t) => t === "プレミアムプラン")).toBe(true);
    });

    it("現在の使用回数と上限が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<PremiumGate {...BASE_PROPS} />);
      const texts = getAllTextContent(UNSAFE_getAllByType);

      // Assert
      expect(texts.some((t) => t === "5 / 5")).toBe(true);
    });

    it("プレミアム機能一覧が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<PremiumGate {...BASE_PROPS} />);
      const texts = getAllTextContent(UNSAFE_getAllByType);

      // Assert
      expect(texts).toContain("AI要約（無制限）");
      expect(texts).toContain("AI翻訳（無制限）");
      expect(texts).toContain("優先サポート");
    });

    it("購入ボタンが表示されること", () => {
      // Arrange & Act
      const { getByLabelText } = render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByLabelText("プレミアムプランを購入する")).toBeDefined();
    });

    it("閉じるボタンが表示されること", () => {
      // Arrange & Act
      const { getByLabelText } = render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByLabelText("閉じる")).toBeDefined();
    });

    it("featuresが空配列の場合も正常にレンダリングできること", () => {
      // Arrange
      const props = { ...BASE_PROPS, features: [] };

      // Act
      const { UNSAFE_getAllByType } = render(<PremiumGate {...props} />);
      const texts = getAllTextContent(UNSAFE_getAllByType);

      // Assert
      expect(texts.some((t) => t === "プレミアムプラン")).toBe(true);
    });

    it("上限超過メッセージが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<PremiumGate {...BASE_PROPS} />);
      const texts = getAllTextContent(UNSAFE_getAllByType);

      // Assert
      expect(texts).toContain("無料プランの上限に達しました");
    });
  });

  describe("使用量表示", () => {
    it("currentUsageが0の場合も正常に表示されること", () => {
      // Arrange
      const props = { ...BASE_PROPS, currentUsage: 0, maxUsage: 10 };

      // Act
      const { UNSAFE_getAllByType } = render(<PremiumGate {...props} />);
      const texts = getAllTextContent(UNSAFE_getAllByType);

      // Assert
      expect(texts.some((t) => t === "0 / 10")).toBe(true);
    });

    it("currentUsageとmaxUsageが同じ値の場合に正しく表示されること", () => {
      // Arrange
      const props = { ...BASE_PROPS, currentUsage: 3, maxUsage: 3 };

      // Act
      const { UNSAFE_getAllByType } = render(<PremiumGate {...props} />);
      const texts = getAllTextContent(UNSAFE_getAllByType);

      // Assert
      expect(texts.some((t) => t === "3 / 3")).toBe(true);
    });
  });

  describe("インタラクション", () => {
    it("購入ボタンタップ時にonPurchaseが呼ばれること", () => {
      // Arrange
      const onPurchase = jest.fn();
      const { getByLabelText } = render(<PremiumGate {...BASE_PROPS} onPurchase={onPurchase} />);

      // Act
      fireEvent.press(getByLabelText("プレミアムプランを購入する"));

      // Assert
      expect(onPurchase).toHaveBeenCalledTimes(1);
    });

    it("閉じるボタンタップ時にonCloseが呼ばれること", () => {
      // Arrange
      const onClose = jest.fn();
      const { getByLabelText } = render(<PremiumGate {...BASE_PROPS} onClose={onClose} />);

      // Act
      fireEvent.press(getByLabelText("閉じる"));

      // Assert
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("アクセシビリティ", () => {
    it("購入ボタンにaccessibilityLabelが設定されていること", () => {
      // Arrange & Act
      const { getByLabelText } = render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByLabelText("プレミアムプランを購入する")).toBeDefined();
    });

    it("閉じるボタンにaccessibilityLabelが設定されていること", () => {
      // Arrange & Act
      const { getByLabelText } = render(<PremiumGate {...BASE_PROPS} />);

      // Assert
      expect(getByLabelText("閉じる")).toBeDefined();
    });
  });
});
