import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Auth } from "../auth";
import type { Database } from "../db";
import { accounts, users, verifications } from "../db/schema";
import { VALIDATION_ERROR_CODE, VALIDATION_ERROR_MESSAGE } from "../lib/error-codes";
import {
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_OK,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import { createLogger } from "../lib/logger";
import { hashTokenSha256 } from "../lib/token-utils";
import type { EmailEnv } from "../services/emailService";
import { sendPasswordReset } from "../services/emailService";

const logger = createLogger();

/** パスワード最小文字数 */
const PASSWORD_MIN_LENGTH = 8;

/** パスワード最大文字数 */
const PASSWORD_MAX_LENGTH = 128;

/** メールアドレス最大文字数 */
const EMAIL_MAX_LENGTH = 255;

/** リセットトークン有効期限（ミリ秒）: 24時間 */
const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** パスワードリセットメール送信済みメッセージ */
const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "パスワードリセットのメールを送信しました。メールをご確認ください。";

/** パスワードリセット完了メッセージ */
const RESET_PASSWORD_SUCCESS_MESSAGE = "パスワードをリセットしました。";

/** トークン無効エラーメッセージ */
const INVALID_TOKEN_MESSAGE =
  "リセットトークンが無効または期限切れです。再度パスワードリセットをお試しください。";

/** パスワードリセットトークンのverification identifier プレフィックス */
const RESET_TOKEN_IDENTIFIER_PREFIX = "password-reset:";

/** forgot-password リクエストスキーマ */
const ForgotPasswordSchema = z.object({
  email: z
    .string({ error: "メールアドレスは必須です" })
    .email("メールアドレスの形式が正しくありません")
    .max(EMAIL_MAX_LENGTH, `メールアドレスは${EMAIL_MAX_LENGTH}文字以内で入力してください`),
});

/** reset-password リクエストスキーマ */
const ResetPasswordSchema = z.object({
  token: z.string({ error: "トークンは必須です" }).min(1, "トークンは必須です"),
  password: z
    .string({ error: "パスワードは必須です" })
    .min(PASSWORD_MIN_LENGTH, `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`)
    .max(PASSWORD_MAX_LENGTH, `パスワードは${PASSWORD_MAX_LENGTH}文字以内で入力してください`),
});

/** createPasswordResetRoute のオプション */
type PasswordResetRouteOptions = {
  db: Database;
  appUrl: string;
  emailEnv: EmailEnv;
  auth: Auth;
};

/**
 * パスワードリセットフロー用のルートを生成する
 *
 * POST /forgot-password: パスワードリセットメール送信
 * POST /reset-password: トークン検証とパスワード更新
 *
 * @param options - DBインスタンスとアプリURL
 * @returns Hono ルーターインスタンス
 */
export function createPasswordResetRoute(options: PasswordResetRouteOptions) {
  const { db, appUrl, emailEnv, auth } = options;
  const route = new Hono();

  route.post("/forgot-password", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const validation = ForgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: validation.error.issues.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const { email } = validation.data;

    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      return c.json(
        {
          success: true,
          data: { message: FORGOT_PASSWORD_SUCCESS_MESSAGE },
        },
        HTTP_OK,
      );
    }

    const rawToken = crypto.randomUUID();
    const hashedToken = await hashTokenSha256(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    await db.insert(verifications).values({
      id: crypto.randomUUID(),
      identifier: `${RESET_TOKEN_IDENTIFIER_PREFIX}${email}`,
      value: hashedToken,
      expiresAt,
    });

    const resetUrl = `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    try {
      await sendPasswordReset(emailEnv, email, user.name ?? email, resetUrl);
    } catch (error) {
      logger.error("パスワードリセットメール送信に失敗しました", { email, error });
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "サーバーエラーが発生しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }

    return c.json(
      {
        success: true,
        data: { message: FORGOT_PASSWORD_SUCCESS_MESSAGE },
      },
      HTTP_OK,
    );
  });

  route.post("/reset-password", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const validation = ResetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: validation.error.issues.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const { token, password } = validation.data;

    const hashedToken = await hashTokenSha256(token);

    const [verification] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.value, hashedToken));

    if (!verification) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: INVALID_TOKEN_MESSAGE,
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    if (new Date(verification.expiresAt) < new Date()) {
      await db.delete(verifications).where(eq(verifications.id, verification.id));
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: INVALID_TOKEN_MESSAGE,
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    const rawIdentifier = verification.identifier;
    const email = rawIdentifier.startsWith(RESET_TOKEN_IDENTIFIER_PREFIX)
      ? rawIdentifier.slice(RESET_TOKEN_IDENTIFIER_PREFIX.length)
      : rawIdentifier;

    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: INVALID_TOKEN_MESSAGE,
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(password);

    await db.update(accounts).set({ password: hashedPassword }).where(eq(accounts.userId, user.id));

    await db.delete(verifications).where(eq(verifications.id, verification.id));

    return c.json(
      {
        success: true,
        data: { message: RESET_PASSWORD_SUCCESS_MESSAGE },
      },
      HTTP_OK,
    );
  });

  return route;
}
