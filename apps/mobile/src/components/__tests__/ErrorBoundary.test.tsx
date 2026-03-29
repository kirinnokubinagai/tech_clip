import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { containsText, findByTestId, queryByTestId } from "@/test-helpers";

import { ErrorBoundary } from "../ErrorBoundary";

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("テストエラーが発生しました");
  }
  return <Text testID="child-content">正常なコンテンツ</Text>;
}

function CustomFallback() {
  return <Text testID="custom-fallback">カスタムエラー画面</Text>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("正常系", () => {
    it("エラーがない場合に子コンポーネントが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "child-content").props.children).toBe("正常なコンテンツ");
    });
  });

  describe("エラーキャッチ", () => {
    it("子コンポーネントのエラーをキャッチしてフォールバックUIが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "error-boundary-fallback")).toBeDefined();
    });

    it("エラーメッセージがフォールバックUIに表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(containsText(UNSAFE_root, "テストエラーが発生しました")).toBe(true);
    });

    it("エラーアイコンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "error-boundary-icon")).toBeDefined();
    });
  });

  describe("カスタムフォールバック", () => {
    it("fallback propが指定された場合にカスタムフォールバックが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "custom-fallback")).toBeDefined();
      expect(queryByTestId(UNSAFE_root, "error-boundary-fallback")).toBeNull();
    });
  });

  describe("リトライ", () => {
    it("再試行ボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "error-boundary-retry")).toBeDefined();
    });

    it("再試行ボタンタップでエラー状態がリセットされること", () => {
      // Arrange
      let shouldThrow = true;
      function ConditionalThrow() {
        if (shouldThrow) {
          throw new Error("テストエラー");
        }
        return <Text testID="recovered-content">復旧済み</Text>;
      }

      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ConditionalThrow />
        </ErrorBoundary>,
      );

      // Act
      shouldThrow = false;
      fireEvent.press(findByTestId(UNSAFE_root, "error-boundary-retry"));

      // Assert
      expect(findByTestId(UNSAFE_root, "recovered-content")).toBeDefined();
    });
  });
});
