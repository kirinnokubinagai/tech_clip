import { createLogger } from "../lib/logger";
import { escapeHtml } from "./email/escape";
import {
  buildEmailVerificationHtml as buildEmailVerificationHtmlTemplate,
  getEmailVerificationSubject,
} from "./email/templates/email-verification";
import {
  buildNotificationDigestHtml as buildNotificationDigestHtmlTemplate,
  getNotificationDigestSubject,
} from "./email/templates/notification-digest";
import {
  buildPasswordResetHtml as buildPasswordResetHtmlTemplate,
  getPasswordResetSubject,
} from "./email/templates/password-reset";

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
  /** Mailpit API エンドポイント（ローカル開発用。設定時は Resend の代わりに使用） */
  MAILPIT_URL?: string;
  /** アプリのベース URL（メールテンプレートのリンクに使用） */
  APP_URL?: string;
};

/** アプリのデフォルトベース URL */
const DEFAULT_APP_URL = "https://techclip.app";

/**
 * Mailpit API を使ってメールを送信する（ローカル開発用）
 *
 * @param mailpitUrl - Mailpit API エンドポイント（例: http://localhost:8025/api/v1/send）
 * @param from - 送信元メールアドレス
 * @param to - 宛先メールアドレス
 * @param subject - 件名
 * @param htmlBody - HTMLボディ
 * @returns 送信結果（messageId を含む）
 * @throws メール送信に失敗した場合
 */
async function sendEmailViaMailpit(
  mailpitUrl: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<SendEmailResult> {
  const response = await fetch(mailpitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      From: { Email: from },
      To: [{ Email: to }],
      Subject: subject,
      HTML: htmlBody,
    }),
  });

  if (!response.ok) {
    logger.error("Mailpit へのメール送信に失敗しました", {
      status: response.status,
      to,
      subject,
    });
    throw new Error(`Mailpit へのメール送信に失敗しました: ステータス ${response.status}`);
  }

  const data = (await response.json()) as { ID: string };
  return { messageId: data.ID };
}

/**
 * メールを送信する（MAILPIT_URL が設定されていれば Mailpit を使用、なければ Resend を使用）
 *
 * @param env - 環境変数（RESEND_API_KEY, FROM_EMAIL, MAILPIT_URL?）
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
  if (env.MAILPIT_URL) {
    const fromEmail = env.FROM_EMAIL || "noreply@techclip.app";
    return sendEmailViaMailpit(env.MAILPIT_URL, fromEmail, to, subject, htmlBody);
  }

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
 * @param appUrl - アプリのベース URL（省略時はデフォルト値を使用）
 * @returns HTMLボディ文字列
 */
export function buildPasswordResetHtml(
  userName: string,
  resetUrl: string,
  appUrl: string = DEFAULT_APP_URL,
): string {
  return buildPasswordResetHtmlTemplate(userName, resetUrl, appUrl);
}

/**
 * メール認証メールのHTMLテンプレートを生成する
 *
 * @param userName - ユーザー名
 * @param verifyUrl - メール認証URL
 * @param appUrl - アプリのベース URL（省略時はデフォルト値を使用）
 * @returns HTMLボディ文字列
 */
export function buildEmailVerificationHtml(
  userName: string,
  verifyUrl: string,
  appUrl: string = DEFAULT_APP_URL,
): string {
  return buildEmailVerificationHtmlTemplate(userName, verifyUrl, appUrl);
}

/**
 * 通知ダイジェストメールのHTMLテンプレートを生成する
 *
 * @param userName - ユーザー名
 * @param notifications - 通知アイテムのリスト
 * @param appUrl - アプリのベース URL（省略時はデフォルト値を使用）
 * @returns HTMLボディ文字列
 */
export function buildNotificationDigestHtml(
  userName: string,
  notifications: NotificationItem[],
  appUrl: string = DEFAULT_APP_URL,
): string {
  return buildNotificationDigestHtmlTemplate(userName, notifications, appUrl);
}

/**
 * パスワードリセットメールを送信する
 *
 * @param env - 環境変数（RESEND_API_KEY, FROM_EMAIL, APP_URL?）
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
  const subject = getPasswordResetSubject();
  const appUrl = env.APP_URL ?? DEFAULT_APP_URL;
  const html = buildPasswordResetHtml(userName, resetUrl, appUrl);
  return sendEmail(env, to, subject, html);
}

/**
 * メールアドレス認証メールを送信する
 *
 * @param env - 環境変数（RESEND_API_KEY, FROM_EMAIL, APP_URL?）
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
  const subject = getEmailVerificationSubject();
  const appUrl = env.APP_URL ?? DEFAULT_APP_URL;
  const html = buildEmailVerificationHtml(userName, verifyUrl, appUrl);
  return sendEmail(env, to, subject, html);
}

/**
 * 通知ダイジェストメールを送信する
 *
 * @param env - 環境変数（RESEND_API_KEY, FROM_EMAIL, APP_URL?）
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
  const subject = getNotificationDigestSubject();
  const appUrl = env.APP_URL ?? DEFAULT_APP_URL;
  const html = buildNotificationDigestHtml(userName, notifications, appUrl);
  return sendEmail(env, to, subject, html);
}

export { escapeHtml };
