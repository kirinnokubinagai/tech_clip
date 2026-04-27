/**
 * 通知ダイジェストメールテンプレート
 */

import type { NotificationItem } from "../../emailService";
import { button, card, divider, muted, spacer } from "../components";
import { escapeHtml } from "../escape";
import { buildEmailLayout } from "../layout";

/**
 * 通知ダイジェストメールの件名を返す
 *
 * @returns 件名文字列
 */
export function getNotificationDigestSubject(): string {
  return "TechClip: 最近の通知をお届けします";
}

/**
 * 通知ダイジェストメールのプリヘッダーテキストを生成する
 *
 * @param count - 通知件数
 * @returns プリヘッダー文字列
 */
export function getNotificationDigestPreheader(count: number): string {
  if (count === 0) {
    return "最近の通知をお届けします。アプリでご確認ください。";
  }
  return `新しい通知が ${count} 件あります。TechClip でご確認ください。`;
}

/**
 * 通知ダイジェストメールの HTML ボディを生成する
 *
 * @param userName - ユーザー名
 * @param notifications - 通知アイテムのリスト
 * @param appUrl - アプリのベース URL（CTA・フッターリンクに使用）
 * @returns 完全な HTML メール文字列
 */
export function buildNotificationDigestHtml(
  userName: string,
  notifications: NotificationItem[],
  appUrl: string,
): string {
  const safeUserName = escapeHtml(userName);

  const notificationCards =
    notifications.length === 0
      ? `<p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;color:#78716c;line-height:1.6;text-align:center;padding:24px 0;">新しい通知はありません</p>`
      : notifications
          .map((n) =>
            card({
              title: escapeHtml(n.title),
              body: escapeHtml(n.body),
            }),
          )
          .join("\n");

  const content = `
<h1 style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:700;color:#1c1917;line-height:1.3;">通知ダイジェスト</h1>
<p style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;color:#44403c;line-height:1.6;">${safeUserName} さん、最近の通知をお届けします。</p>

${notificationCards}

${spacer({ height: 24 })}
${button({ text: "アプリで確認する", href: `${appUrl}/notifications` })}
${spacer({ height: 24 })}
${divider()}
${spacer({ height: 16 })}

${muted({ text: `メール配信を停止するには: <a href="${appUrl}/settings/notifications" style="color:#0d9488;">通知設定を変更する</a>` })}
  `.trim();

  return buildEmailLayout({
    title: getNotificationDigestSubject(),
    preheader: getNotificationDigestPreheader(notifications.length),
    content,
    appUrl,
  });
}
