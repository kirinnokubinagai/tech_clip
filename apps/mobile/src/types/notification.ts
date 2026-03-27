/** 通知の種別 */
export type NotificationType = "like" | "comment" | "follow" | "system" | "article";

/** 通知アイテムのデータ型 */
export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  articleId?: string;
  actorName?: string;
};

/** 通知一覧APIレスポンス */
export type NotificationsListResponse = {
  success: true;
  data: NotificationItem[];
  meta: {
    nextCursor: string | null;
    hasNext: boolean;
    unreadCount: number;
  };
};
