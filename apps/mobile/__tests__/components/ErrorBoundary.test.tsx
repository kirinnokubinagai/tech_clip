import { fireEvent, render } from "@testing-library/react-native";
import { Text, View } from "react-native";

import { ErrorBoundary } from "../../src/components/ErrorBoundary";

/** テスト用エラーをthrowするコンポーネント */
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("テスト用エラー");
  }
  return <View testID="normal-content" />;
}

/** コンソールエラーを抑制する */
const originalConsoleError = console.error;

describe("ErrorBoundary", () => {
  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("正常時", () => {
    it("エラーが発生しない場合は子コンポーネントが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByTestId("normal-content")).toBeDefined();
    });

    it("エラーが発生しない場合はフォールバックUIが表示されないこと", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>,
      );

      // Assert
      expect(queryByTestId("error-boundary-fallback")).toBeNull();
    });
  });

  describe("エラー発生時", () => {
    it("エラーが発生した場合はフォールバックUIが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByTestId("error-boundary-fallback")).toBeDefined();
    });

    it("エラーが発生した場合は子コンポーネントが非表示になること", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(queryByTestId("normal-content")).toBeNull();
    });

    it("エラーアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByTestId("error-boundary-icon")).toBeDefined();
    });

    it("再試行ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByTestId("error-boundary-retry")).toBeDefined();
    });
  });

  describe("カスタムfallback", () => {
    it("fallbackが指定された場合はそちらが表示されること", async () => {
      // Arrange
      const CustomFallback = <View testID="custom-fallback" />;

      // Act
      const { getByTestId, queryByTestId } = await render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByTestId("custom-fallback")).toBeDefined();
      expect(queryByTestId("error-boundary-fallback")).toBeNull();
    });
  });

  describe("再試行", () => {
    it("再試行ボタンを押すとエラー状態がリセットされること", async () => {
      // Arrange
      const { getByTestId } = await render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Act
      await fireEvent.press(getByTestId("error-boundary-retry"));

      // Assert
      expect(getByTestId("error-boundary-fallback")).toBeDefined();
    });
  });

  describe("エラーメッセージ表示", () => {
    it("エラーメッセージがフォールバックUIに含まれること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(getByText("テスト用エラー")).toBeDefined();
    });
  });
});
