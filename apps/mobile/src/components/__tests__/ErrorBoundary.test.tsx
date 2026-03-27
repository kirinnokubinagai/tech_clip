import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { ErrorBoundary } from "../ErrorBoundary";

/** テスト用：常にエラーを投げるコンポーネント */
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("テストエラーが発生しました");
  }
  return <Text testID="child-content">正常なコンテンツ</Text>;
}

/** テスト用：カスタムフォールバック */
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
      const { getByTestId } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByTestId("child-content").props.children).toBe("正常なコンテンツ");
    });
  });

  describe("エラーキャッチ", () => {
    it("子コンポーネントのエラーをキャッチしてフォールバックUIが表示されること", () => {
      // Arrange & Act
      const { getByTestId } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByTestId("error-boundary-fallback")).toBeDefined();
    });

    it("エラーメッセージがフォールバックUIに表示されること", () => {
      // Arrange & Act
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByText("テストエラーが発生しました")).toBeDefined();
    });

    it("エラーアイコンが表示されること", () => {
      // Arrange & Act
      const { getByTestId } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByTestId("error-boundary-icon")).toBeDefined();
    });
  });

  describe("カスタムフォールバック", () => {
    it("fallback propが指定された場合にカスタムフォールバックが表示されること", () => {
      // Arrange & Act
      const { getByTestId, queryByTestId } = render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByTestId("custom-fallback")).toBeDefined();
      expect(queryByTestId("error-boundary-fallback")).toBeNull();
    });
  });

  describe("リトライ", () => {
    it("再試行ボタンが表示されること", () => {
      // Arrange & Act
      const { getByTestId } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByTestId("error-boundary-retry")).toBeDefined();
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

      const { getByTestId } = render(
        <ErrorBoundary>
          <ConditionalThrow />
        </ErrorBoundary>,
      );

      // Act
      shouldThrow = false;
      fireEvent.press(getByTestId("error-boundary-retry"));

      // Assert
      expect(getByTestId("recovered-content")).toBeDefined();
    });
  });
});
