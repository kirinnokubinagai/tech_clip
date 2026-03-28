import { createLogger } from "../lib/logger";

const logger = createLogger();

/** Resend API エンドポイント */
const RESEND_API_ENDPOINT = "https://api.resend.com/emails";

/** メール送信結果 */
export type SendEmailResult = {
  messageId: string;
};

/** 通知ダイジェストの通知アイテム */
export type NotificationItem = {
  title: string;
  body: string;
};

/** メール送信に必要な環境変数 */
export type EmailEnv = {
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
};

/**
 * Resend API を使ってメールを送信する
 *
 * @param env - 環境変数（RESEND_API_KEY, FROM_EMAIL）
 * @param to - 宛先メールアドレス
 * @param subject - 件名
 * @param htmlBody - HTMLボディ
 * @returns 送信結果（messageId を含む）
 * @throws メール送信に失敗した場合
 */
export async function sendEmail(
  env: EmailEnv,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<SendEmailResult> {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY が設定されていません");
  }
  if (!env.FROM_EMAIL) {
    throw new Error("FROM_EMAIL が設定されていません");
  }

  const apiKey = env.RESEND_API_KEY;
  const fromEmail = env.FROM_EMAIL;

  const response = await fetch(RESEND_API_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject,
      html: htmlBody,
    }),
  });

  if (!response.ok) {
    logger.error("メール送信に失敗しました", {
      status: response.status,
      to,
      subject,
    });
    throw new Error(`メール送信に失敗しました: ステータス ${response.status}`);
  }

  const data = (await response.json()) as { id: string };
  return { messageId: data.id };
}

/**
 * パスワードリセットメールのHTMLテンプレートを生成する
 *
 * @param userName - ユーザー名
 * @param resetUrl - パスワードリセットURL
 * @returns HTMLボディ文字列
 */
function buildPasswordResetHtml(userName: string, resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>パスワードリセット</h1>
      <p>${userName} さん、</p>
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>以下のリンクをクリックしてパスワードをリセットしてください。</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>このリンクは24時間有効です。リクエストした覚えがない場合は、このメールを無視してください。</p>
    </div>
  `;
}

/**
 * メール認証メールのHTMLテンプレートを生成する
 *
 * @param userName - ユーザー名
 * @param verifyUrl - メール認証URL
 * @returns HTMLボディ文字列
 */
function buildEmailVerificationHtml(userName: string, verifyUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>メールアドレス認証</h1>
      <p>${userName} さん、TechClip へようこそ！</p>
      <p>メールアドレスを認証するために、以下のリンクをクリックしてください。</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>このリンクは24時間有効です。</p>
    </div>
  `;
}

/**
 * 通知ダイジェストメールのHTMLテンプレートを生成する
 *
 * @param userName - ユーザー名
 * @param notifications - 通知アイテムのリスト
 * @returns HTMLボディ文字列
 */
function buildNotificationDigestHtml(userName: string, notifications: NotificationItem[]): string {
  const notificationItems = notifications
    .map(
      (n) => `
        <li style="margin-bottom: 12px;">
          <strong>${n.title}</strong>
          <p style="margin: 4px 0 0;">${n.body}</p>
        </li>
      `,
    )
    .join("");

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>通知ダイジェスト</h1>
      <p>${userName} さん、</p>
      <p>最近の通知をお届けします。</p>
      <ul style="padding-left: 20px;">
        ${notificationItems}
      </ul>
    </div>
  `;
}

/**
 * パスワードリセットメールを送信する
 *
 * @param to - 宛先メールアドレス
 * @param userName - ユーザー名
 * @param resetUrl - パスワードリセットURL
 * @returns 送信結果
 */
export async function sendPasswordReset(
  env: EmailEnv,
  to: string,
  userName: string,
  resetUrl: string,
): Promise<SendEmailResult> {
  const subject = "パスワードリセットのご案内";
  const html = buildPasswordResetHtml(userName, resetUrl);
  return sendEmail(env, to, subject, html);
}

/**
 * メールアドレス認証メールを送信する
 *
 * @param env - 環境変数（RESEND_API_KEY, FROM_EMAIL）
 * @param to - 宛先メールアドレス
 * @param userName - ユーザー名
 * @param verifyUrl - メール認証URL
 * @returns 送信結果
 */
export async function sendEmailVerification(
  env: EmailEnv,
  to: string,
  userName: string,
  verifyUrl: string,
): Promise<SendEmailResult> {
  const subject = "メールアドレス認証のご案内";
  const html = buildEmailVerificationHtml(userName, verifyUrl);
  return sendEmail(env, to, subject, html);
}

/**
 * 通知ダイジェストメールを送信する
 *
 * @param env - 環境変数（RESEND_API_KEY, FROM_EMAIL）
 * @param to - 宛先メールアドレス
 * @param userName - ユーザー名
 * @param notifications - 通知アイテムのリスト
 * @returns 送信結果
 */
export async function sendNotificationDigest(
  env: EmailEnv,
  to: string,
  userName: string,
  notifications: NotificationItem[],
): Promise<SendEmailResult> {
  const subject = "通知ダイジェスト";
  const html = buildNotificationDigestHtml(userName, notifications);
  return sendEmail(env, to, subject, html);
}
