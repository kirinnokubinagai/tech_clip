/**
 * API テスト共通セットアップ
 *
 * global fetch を横断インターセプトし、Resend API 宛ての呼び出しを
 * mailpit SMTP に転送する。mailpit 未起動時はモック成功レスポンスを返す。
 */
import nodemailer from "nodemailer";
import { afterAll, beforeAll, vi } from "vitest";

/** mailpit SMTP ホスト */
const MAILPIT_SMTP_HOST = "localhost";

/** mailpit SMTP ポート */
const MAILPIT_SMTP_PORT = 1025;

/** インターセプト対象 URL プレフィックス */
const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";

/** mailpit 未起動時のフォールバック messageId */
const FALLBACK_MESSAGE_ID = "test_mock_email_id";

let nativeFetch: typeof globalThis.fetch;

/**
 * RequestInfo | URL から URL 文字列を解決する
 */
function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * URL が Resend メール送信エンドポイントかどうかを判定する
 */
function isResendEmailsUrl(url: string): boolean {
  return url.startsWith(RESEND_EMAILS_ENDPOINT);
}

/**
 * Resend ペイロードの to フィールドを string[] に正規化する
 */
function normalizeRecipients(to: unknown): string[] {
  if (Array.isArray(to)) {
    return to.filter((v): v is string => typeof v === "string");
  }
  if (typeof to === "string") return [to];
  return ["test@example.com"];
}

/**
 * Resend API リクエストを mailpit SMTP に転送する。
 * mailpit 未起動の場合はモック成功レスポンスを返す。
 */
async function handleResendIntercept(init: RequestInit | undefined): Promise<Response> {
  const transport = nodemailer.createTransport({
    host: MAILPIT_SMTP_HOST,
    port: MAILPIT_SMTP_PORT,
    secure: false,
    ignoreTLS: true,
    connectionTimeout: 500,
    greetingTimeout: 500,
  });

  try {
    await transport.verify();

    const bodyStr = typeof init?.body === "string" ? init.body : null;
    const body = bodyStr !== null ? (JSON.parse(bodyStr) as Record<string, unknown>) : {};

    const from = typeof body.from === "string" ? body.from : "test@example.com";
    const to = normalizeRecipients(body.to);
    const subject = typeof body.subject === "string" ? body.subject : "(no subject)";
    const html = typeof body.html === "string" ? body.html : "";

    const info = await transport.sendMail({ from, to, subject, html });

    return new Response(JSON.stringify({ id: info.messageId ?? "mailpit_test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ id: FALLBACK_MESSAGE_ID }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

beforeAll(() => {
  nativeFetch = globalThis.fetch.bind(globalThis);

  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = resolveUrl(input);
      if (!isResendEmailsUrl(url)) {
        return nativeFetch(input, init);
      }
      return handleResendIntercept(init);
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});
