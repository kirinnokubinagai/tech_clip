import { fireEvent, render } from "@testing-library/react-native";

import { containsText, findByTestId, queryByTestId } from "@/test-helpers";

import { ErrorView } from "../ErrorView";

describe("ErrorView", () => {
  describe("デフォルト表示", () => {
    it("デフォルトのgenericエラータイトルが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-title").props.children).toBe(
        "エラーが発生しました",
      );
    });

    it("デフォルトのgenericエラーメッセージが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-message").props.children).toBe(
        "問題が発生しました。再度お試しください",
      );
    });

    it("genericエラーアイコンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-icon-generic")).toBeDefined();
    });
  });

  describe("エラー種別", () => {
    it("networkエラーでネットワークアイコンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView errorType="network" />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-icon-network")).toBeDefined();
      expect(findByTestId(UNSAFE_root, "error-view-title").props.children).toBe(
        "ネットワークエラー",
      );
    });

    it("serverエラーでサーバーアイコンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView errorType="server" />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-icon-server")).toBeDefined();
      expect(findByTestId(UNSAFE_root, "error-view-title").props.children).toBe("サーバーエラー");
    });
  });

  describe("カスタムメッセージ", () => {
    it("カスタムタイトルが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView title="カスタムタイトル" />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-title").props.children).toBe(
        "カスタムタイトル",
      );
    });

    it("カスタムメッセージが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView message="カスタムメッセージ" />);

      // Assert
      expect(findByTestId(UNSAFE_root, "error-view-message").props.children).toBe(
        "カスタムメッセージ",
      );
    });
  });

  describe("再試行ボタン", () => {
    it("onRetryが未指定の場合に再試行ボタンが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "error-view-retry")).toBeNull();
    });

    it("onRetryが指定された場合に再試行ボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView onRetry={() => {}} />);

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

    it("カスタムリトライラベルが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ErrorView onRetry={() => {}} retryLabel="もう一度試す" />);

      // Assert
      expect(containsText(UNSAFE_root, "もう一度試す")).toBe(true);
    });
  });
});
