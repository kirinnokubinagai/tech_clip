import { fireEvent, render } from "@testing-library/react-native";

import { NotificationItem } from "../../../apps/mobile/src/components/NotificationItem";

/** テスト用の通知データ（未読） */
const UNREAD_NOTIFICATION = {
  id: "01JTEST000000000000000001",
  type: "like" as const,
  title: "記事にいいねされました",
  body: "tech_writerさんがあなたの記事にいいねしました",
  isRead: false,
  createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
};

/** テスト用の通知データ（既読） */
const READ_NOTIFICATION = {
  ...UNREAD_NOTIFICATION,
  id: "01JTEST000000000000000002",
  isRead: true,
};

describe("NotificationItem", () => {
  describe("レンダリング", () => {
    it("タイトルが正しく表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(getByTestId("notification-title").props.children).toBe("記事にいいねされました");
    });

    it("本文が正しく表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(getByTestId("notification-body").props.children).toBe(
        "tech_writerさんがあなたの記事にいいねしました",
      );
    });

    it("相対時間が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(getByTestId("notification-time")).toBeDefined();
    });
  });

  describe("未読・既読の表示", () => {
    it("未読通知の場合に未読インジケーターが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(getByTestId("unread-indicator")).toBeDefined();
    });

    it("既読通知の場合に未読インジケーターが表示されないこと", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(
        <NotificationItem notification={READ_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(queryByTestId("unread-indicator")).toBeNull();
    });
  });

  describe("通知種別アイコン", () => {
    it("likeタイプでハートアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(getByTestId("notification-icon-like")).toBeDefined();
    });

    it("commentタイプでコメントアイコンが表示されること", async () => {
      // Arrange
      const notification = { ...UNREAD_NOTIFICATION, type: "comment" as const };

      // Act
      const { getByTestId } = await render(
        <NotificationItem notification={notification} onPress={() => {}} />,
      );

      // Assert
      expect(getByTestId("notification-icon-comment")).toBeDefined();
    });

    it("followタイプでフォローアイコンが表示されること", async () => {
      // Arrange
      const notification = { ...UNREAD_NOTIFICATION, type: "follow" as const };

      // Act
      const { getByTestId } = await render(
        <NotificationItem notification={notification} onPress={() => {}} />,
      );

      // Assert
      expect(getByTestId("notification-icon-follow")).toBeDefined();
    });

    it("systemタイプでベルアイコンが表示されること", async () => {
      // Arrange
      const notification = { ...UNREAD_NOTIFICATION, type: "system" as const };

      // Act
      const { getByTestId } = await render(
        <NotificationItem notification={notification} onPress={() => {}} />,
      );

      // Assert
      expect(getByTestId("notification-icon-system")).toBeDefined();
    });

    it("articleタイプで記事アイコンが表示されること", async () => {
      // Arrange
      const notification = { ...UNREAD_NOTIFICATION, type: "article" as const };

      // Act
      const { getByTestId } = await render(
        <NotificationItem notification={notification} onPress={() => {}} />,
      );

      // Assert
      expect(getByTestId("notification-icon-article")).toBeDefined();
    });
  });

  describe("インタラクション", () => {
    it("タップ時にonPressが呼ばれること", async () => {
      // Arrange
      const onPress = jest.fn();
      const { getByTestId } = await render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={onPress} />,
      );

      // Act
      await fireEvent.press(getByTestId("notification-item"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
