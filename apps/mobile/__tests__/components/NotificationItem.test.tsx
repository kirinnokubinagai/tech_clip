import { fireEvent, render } from "@testing-library/react-native";

import { NotificationItem } from "../../src/components/NotificationItem";
import type { NotificationItemData } from "../../src/components/NotificationItem";

/** テスト用通知データのファクトリ */
function makeNotification(overrides: Partial<NotificationItemData> = {}): NotificationItemData {
  return {
    id: "notif-1",
    type: "like",
    title: "テストタイトル",
    body: "テスト本文",
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("NotificationItem", () => {
  describe("レンダリング", () => {
    it("通知アイテムが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={makeNotification()} onPress={jest.fn()} />,
      );

      // Assert
      expect(getByTestId("notification-item")).toBeDefined();
    });

    it("タイトルが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={makeNotification()} onPress={jest.fn()} />,
      );

      // Assert
      const title = getByTestId("notification-title");
      expect(title.props.children).toBe("テストタイトル");
    });

    it("本文が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={makeNotification()} onPress={jest.fn()} />,
      );

      // Assert
      const body = getByTestId("notification-body");
      expect(body.props.children).toBe("テスト本文");
    });
  });

  describe("通知種別アイコン", () => {
    it("like通知のアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={makeNotification({ type: "like" })} onPress={jest.fn()} />,
      );

      // Assert
      expect(getByTestId("notification-icon-like")).toBeDefined();
    });

    it("comment通知のアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem
          notification={makeNotification({ type: "comment" })}
          onPress={jest.fn()}
        />,
      );

      // Assert
      expect(getByTestId("notification-icon-comment")).toBeDefined();
    });

    it("follow通知のアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem
          notification={makeNotification({ type: "follow" })}
          onPress={jest.fn()}
        />,
      );

      // Assert
      expect(getByTestId("notification-icon-follow")).toBeDefined();
    });

    it("system通知のアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem
          notification={makeNotification({ type: "system" })}
          onPress={jest.fn()}
        />,
      );

      // Assert
      expect(getByTestId("notification-icon-system")).toBeDefined();
    });

    it("article通知のアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem
          notification={makeNotification({ type: "article" })}
          onPress={jest.fn()}
        />,
      );

      // Assert
      expect(getByTestId("notification-icon-article")).toBeDefined();
    });
  });

  describe("未読インジケーター", () => {
    it("未読の場合インジケーターが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={makeNotification({ isRead: false })} onPress={jest.fn()} />,
      );

      // Assert
      expect(getByTestId("unread-indicator")).toBeDefined();
    });

    it("既読の場合インジケーターが表示されないこと", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(
        <NotificationItem notification={makeNotification({ isRead: true })} onPress={jest.fn()} />,
      );

      // Assert
      expect(queryByTestId("unread-indicator")).toBeNull();
    });
  });

  describe("相対時間", () => {
    it("時間表示が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={makeNotification()} onPress={jest.fn()} />,
      );

      // Assert
      expect(getByTestId("notification-time")).toBeDefined();
    });

    it("直近の通知はたった今と表示されること", async () => {
      // Arrange
      const recentDate = new Date(Date.now() - 30 * 1000).toISOString();

      // Act
      const { getByTestId } = await render(
        <NotificationItem
          notification={makeNotification({ createdAt: recentDate })}
          onPress={jest.fn()}
        />,
      );

      // Assert
      const time = getByTestId("notification-time");
      expect(time.props.children).toBe("たった今");
    });

    it("数分前の通知はN分前と表示されること", async () => {
      // Arrange
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      // Act
      const { getByTestId } = await render(
        <NotificationItem
          notification={makeNotification({ createdAt: fiveMinutesAgo })}
          onPress={jest.fn()}
        />,
      );

      // Assert
      const time = getByTestId("notification-time");
      expect(time.props.children).toBe("5分前");
    });
  });

  describe("インタラクション", () => {
    it("タップ時にonPressが呼ばれること", async () => {
      // Arrange
      const onPress = jest.fn();
      const { getByTestId } = await render(
        <NotificationItem notification={makeNotification()} onPress={onPress} />,
      );

      // Act
      await fireEvent.press(getByTestId("notification-item"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("アクセシビリティ", () => {
    it("accessibilityLabelがタイトルになっていること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <NotificationItem notification={makeNotification()} onPress={jest.fn()} />,
      );

      // Assert
      const item = getByTestId("notification-item");
      expect(item.props.accessibilityLabel).toBe("テストタイトル");
    });
  });
});
