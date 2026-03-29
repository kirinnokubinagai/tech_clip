import { fireEvent, render } from "@testing-library/react-native";

import { findByTestId, queryByTestId } from "@/test-helpers";

import { NotificationItem } from "../NotificationItem";

/** テスト用の通知データ（未読） */
const UNREAD_NOTIFICATION = {
  id: "01JTEST000000000000000001",
  type: "like" as const,
  title: "記事にいいねされました",
  body: "tech_writerさんがあなたの記事にいいねしました",
  isRead: false,
  createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
};

/** テスト用の通知デ���タ（既読） */
const READ_NOTIFICATION = {
  ...UNREAD_NOTIFICATION,
  id: "01JTEST000000000000000002",
  isRead: true,
};

describe("NotificationItem", () => {
  describe("レンダリング", () => {
    it("タイトルが正し��表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "notification-title").props.children).toBe(
        "記事にいいねされました",
      );
    });

    it("本文が正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "notification-body").props.children).toBe(
        "tech_writerさんがあなたの記事にいいねしました",
      );
    });

    it("相対時間が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "notification-time")).toBeDefined();
    });
  });

  describe("未読・既読の表示", () => {
    it("未読通知の場合に未読インジケーターが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "unread-indicator")).toBeDefined();
    });

    it("既読通知の場合に未読インジケーターが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <NotificationItem notification={READ_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(queryByTestId(UNSAFE_root, "unread-indicator")).toBeNull();
    });
  });

  describe("通知種別アイコン", () => {
    it("likeタイプでハートアイコン��表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "notification-icon-like")).toBeDefined();
    });

    it("commentタイプでコメントアイコン��表示されること", () => {
      // Arrange
      const notification = { ...UNREAD_NOTIFICATION, type: "comment" as const };

      // Act
      const { UNSAFE_root } = render(
        <NotificationItem notification={notification} onPress={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "notification-icon-comment")).toBeDefined();
    });

    it("followタイプでフォローアイコンが表���されること", () => {
      // Arrange
      const notification = { ...UNREAD_NOTIFICATION, type: "follow" as const };

      // Act
      const { UNSAFE_root } = render(
        <NotificationItem notification={notification} onPress={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "notification-icon-follow")).toBeDefined();
    });

    it("systemタイプでベルアイコンが表示されること", () => {
      // Arrange
      const notification = { ...UNREAD_NOTIFICATION, type: "system" as const };

      // Act
      const { UNSAFE_root } = render(
        <NotificationItem notification={notification} onPress={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "notification-icon-system")).toBeDefined();
    });

    it("articleタイプで記事ア��コンが表示される���と", () => {
      // Arrange
      const notification = { ...UNREAD_NOTIFICATION, type: "article" as const };

      // Act
      const { UNSAFE_root } = render(
        <NotificationItem notification={notification} onPress={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "notification-icon-article")).toBeDefined();
    });
  });

  describe("インタラクション", () => {
    it("タップ時にonPressが呼ばれ��こと", () => {
      // Arrange
      const onPress = jest.fn();
      const { UNSAFE_root } = render(
        <NotificationItem notification={UNREAD_NOTIFICATION} onPress={onPress} />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "notification-item"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
