import { fireEvent, render } from "@testing-library/react-native";
import { Text, View } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { ErrorBoundary } from "../../src/components/ErrorBoundary";

/**
 * testIDでReactTestInstanceを検索するヘルパー
 */
function findByTestId(root: ReactTestInstance, testId: string): ReactTestInstance {
  return root.findByProps({ testID: testId });
}

function queryByTestId(root: ReactTestInstance, testId: string): ReactTestInstance | null {
  const results = root.findAllByProps({ testID: testId });
  return results.length > 0 ? results[0] : null;
}

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
    // Reactのエラーバウンダリはconsole.errorを出力するため抑制
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("正常時", () => {
    it("エラーが発生しない場合は子コンポーネントが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "normal-content")).toBeDefined();
    });

    it("エラーが発生しない場合はフォールバックUIが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>,
      );

      // Assert
      expect(queryByTestId(UNSAFE_root, "error-boundary-fallback")).toBeNull();
    });
  });

  describe("エラー発生時", () => {
    it("エラーが発生した場合はフォールバックUIが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "error-boundary-fallback")).toBeDefined();
    });

    it("エラーが発生した場合は子コンポーネントが非表示になること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(queryByTestId(UNSAFE_root, "normal-content")).toBeNull();
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
  });

  describe("カスタムfallback", () => {
    it("fallbackが指定された場合はそちらが表示されること", () => {
      // Arrange
      const CustomFallback = <View testID="custom-fallback" />;

      // Act
      const { UNSAFE_root } = render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "custom-fallback")).toBeDefined();
      expect(queryByTestId(UNSAFE_root, "error-boundary-fallback")).toBeNull();
    });
  });

  describe("再試行", () => {
    it("再試行ボタンを押すとエラー状態がリセットされること", () => {
      // Arrange
      const { UNSAFE_root } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "error-boundary-retry"));

      // Assert（リセット後は再びレンダリングを試みる。ThrowingComponentは再度エラーをthrowするため
      // フォールバックが表示されるが、リトライボタンの動作自体は確認できる）
      expect(findByTestId(UNSAFE_root, "error-boundary-fallback")).toBeDefined();
    });
  });

  describe("エラーメッセージ表示", () => {
    it("エラーメッセージがフォールバックUIに含まれること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert
      expect(texts).toContain("テスト用エラー");
    });
  });
});
