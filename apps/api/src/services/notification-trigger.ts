import type { Database } from "../db";
import { notifications } from "../db/schema";

/** フォロー通知タイプ */
const NOTIFICATION_TYPE_FOLLOW = "follow";

/** 要約完了通知タイプ */
const NOTIFICATION_TYPE_SUMMARY_COMPLETE = "summary_complete";

/** フォロー通知タイトル */
const FOLLOW_NOTIFICATION_TITLE = "新しいフォロワー";

/** 要約完了通知タイトル */
const SUMMARY_COMPLETE_NOTIFICATION_TITLE = "要約が完了しました";

/** フォロワー名未指定時のデフォルト名 */
const DEFAULT_FOLLOWER_NAME = "ユーザー";

/** 通知トリガーの共通オプション */
export type NotificationTriggerOptions = {
  db: Database;
};

/** フォロー通知作成のオプション */
type FollowNotificationOptions = NotificationTriggerOptions & {
  followerId: string;
  followingId: string;
  followerName?: string;
};

/** 要約完了通知作成のオプション */
type SummaryCompleteNotificationOptions = NotificationTriggerOptions & {
  userId: string;
  articleId: string;
  articleTitle: string;
  summaryId: string;
};

/**
 * フォロー通知を作成する
 *
 * フォローされたユーザーに対して通知レコードをnotificationsテーブルに挿入する。
 *
 * @param options - フォロー通知作成に必要なオプション
 * @returns 作成された通知レコード
 */
export async function createFollowNotification(options: FollowNotificationOptions) {
  const { db, followerId, followingId, followerName } = options;
  const displayName = followerName ?? DEFAULT_FOLLOWER_NAME;

  const id = crypto.randomUUID();

  const [inserted] = await db
    .insert(notifications)
    .values({
      id,
      userId: followingId,
      type: NOTIFICATION_TYPE_FOLLOW,
      title: FOLLOW_NOTIFICATION_TITLE,
      body: `${displayName}さんがあなたをフォローしました`,
      data: JSON.stringify({ followerId }),
    })
    .returning();

  return inserted;
}

/**
 * 要約完了通知を作成する
 *
 * 要約が完了した記事の所有者に対して通知レコードをnotificationsテーブルに挿入する。
 *
 * @param options - 要約完了通知作成に必要なオプション
 * @returns 作成された通知レコード
 */
export async function createSummaryCompleteNotification(
  options: SummaryCompleteNotificationOptions,
) {
  const { db, userId, articleId, articleTitle, summaryId } = options;

  const id = crypto.randomUUID();

  const [inserted] = await db
    .insert(notifications)
    .values({
      id,
      userId,
      type: NOTIFICATION_TYPE_SUMMARY_COMPLETE,
      title: SUMMARY_COMPLETE_NOTIFICATION_TITLE,
      body: `「${articleTitle}」の要約が完了しました`,
      data: JSON.stringify({ articleId, summaryId }),
    })
    .returning();

  return inserted;
}
