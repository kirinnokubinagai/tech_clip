import { fireEvent, render } from "@testing-library/react-native";

import { ErrorView } from "../../src/components/ErrorView";

describe("ErrorView", () => {
  describe("デフォルト表示（generic）", () => {
    it("エラービューが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ErrorView />);

      // Assert
      expect(getByTestId("error-view")).toBeDefined();
    });

    it("デフォルトタイトルが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ErrorView />);

      // Assert
      expect(getByText("エラーが発生しました")).toBeDefined();
    });

    it("デフォルトメッセージが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ErrorView />);

      // Assert
      expect(getByText("問題が発生しました。再度お試しください")).toBeDefined();
    });

    it("genericアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ErrorView />);

      // Assert
      expect(getByTestId("error-view-icon-generic")).toBeDefined();
    });
  });

  describe("networkエラー", () => {
    it("networkアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ErrorView errorType="network" />);

      // Assert
      expect(getByTestId("error-view-icon-network")).toBeDefined();
    });

    it("ネットワークエラーのデフォルトタイトルが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ErrorView errorType="network" />);

      // Assert
      expect(getByText("ネットワークエラー")).toBeDefined();
    });
  });

  describe("serverエラー", () => {
    it("serverアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ErrorView errorType="server" />);

      // Assert
      expect(getByTestId("error-view-icon-server")).toBeDefined();
    });

    it("サーバーエラーのデフォルトタイトルが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ErrorView errorType="server" />);

      // Assert
      expect(getByText("サーバーエラー")).toBeDefined();
    });
  });

  describe("カスタムtitle/message", () => {
    it("カスタムタイトルが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ErrorView title="カスタムタイトル" />);

      // Assert
      expect(getByText("カスタムタイトル")).toBeDefined();
    });

    it("カスタムメッセージが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ErrorView message="カスタムメッセージ" />);

      // Assert
      expect(getByText("カスタムメッセージ")).toBeDefined();
    });
  });

  describe("再試行ボタン", () => {
    it("onRetryが未指定の場合再試行ボタンが表示されないこと", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(<ErrorView />);

      // Assert
      expect(queryByTestId("error-view-retry")).toBeNull();
    });

    it("onRetryが指定された場合再試行ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ErrorView onRetry={jest.fn()} />);

      // Assert
      expect(getByTestId("error-view-retry")).toBeDefined();
    });

    it("再試行ボタンタップ時にonRetryが呼ばれること", async () => {
      // Arrange
      const onRetry = jest.fn();
      const { getByTestId } = await render(<ErrorView onRetry={onRetry} />);

      // Act
      await fireEvent.press(getByTestId("error-view-retry"));

      // Assert
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("カスタムretryLabelが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <ErrorView onRetry={jest.fn()} retryLabel="もう一度試す" />,
      );

      // Assert
      expect(getByText("もう一度試す")).toBeDefined();
    });

    it("デフォルトretryLabelが再試行であること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ErrorView onRetry={jest.fn()} />);

      // Assert
      expect(getByText("再試行")).toBeDefined();
    });
  });
});
