import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { ErrorView } from "../../src/components/ErrorView";

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

describe("ErrorView", () => {
  describe("デフォルト表示（generic）", () => {
    it("エラービューが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view")).toBeDefined();
    });

    it("デフォルトタイトルが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<ErrorView />);
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert
      expect(texts).toContain("エラーが発生しました");
    });

    it("デフォルトメッセージが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<ErrorView />);
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert
      expect(texts).toContain("問題が発生しました。再度お試しください");
    });

    it("genericアイコンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-icon-generic")).toBeDefined();
    });
  });

  describe("networkエラー", () => {
    it("networkアイコンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView errorType="network" />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-icon-network")).toBeDefined();
    });

    it("ネットワークエラーのデフォルトタイトルが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<ErrorView errorType="network" />);
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert
      expect(texts).toContain("ネットワークエラー");
    });
  });

  describe("serverエラー", () => {
    it("serverアイコンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView errorType="server" />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-icon-server")).toBeDefined();
    });

    it("サーバーエラーのデフォルトタイトルが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<ErrorView errorType="server" />);
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert
      expect(texts).toContain("サーバーエラー");
    });
  });

  describe("カスタムtitle/message", () => {
    it("カスタムタイトルが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<ErrorView title="カスタムタイトル" />);
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert
      expect(texts).toContain("カスタムタイトル");
    });

    it("カスタムメッセージが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<ErrorView message="カスタムメッセージ" />);
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert
      expect(texts).toContain("カスタムメッセージ");
    });
  });

  describe("再試行ボタン", () => {
    it("onRetryが未指定の場合再試行ボタンが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "error-view-retry")).toBeNull();
    });

    it("onRetryが指定された場合再試行ボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView onRetry={jest.fn()} />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-retry")).toBeDefined();
    });

    it("再試行ボタンタップ時にonRetryが呼ばれること", () => {
      // Arrange
      const onRetry = jest.fn();
      const { UNSAFE_root } = render(<ErrorView onRetry={onRetry} />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "error-view-retry"));

      // Assert
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("カスタムretryLabelが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <ErrorView onRetry={jest.fn()} retryLabel="もう一度試す" />,
      );
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert
      expect(texts).toContain("もう一度試す");
    });

    it("デフォルトretryLabelが再試行であること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(<ErrorView onRetry={jest.fn()} />);
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert
      expect(texts).toContain("再試行");
    });
  });
});
