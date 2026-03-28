import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { users, verifications } from "../db/schema";
import { createLogger } from "../lib/logger";
import { sendEmailVerification } from "../services/emailService";

const logger = createLogger();

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 400 Bad Request ステータスコード */
const HTTP_BAD_REQUEST = 400;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 404 Not Found ステータスコード */
const HTTP_NOT_FOUND = 404;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** 未認証エラーコード */
const AUTH_ERROR_CODE = "AUTH_REQUIRED";

/** 未認証エラーメッセージ */
const AUTH_ERROR_MESSAGE = "ログインが必要です";

/** バリデーションエラーコード */
const VALIDATION_ERROR_CODE = "VALIDATION_FAILED";

/** バリデーションエラーメッセージ */
const VALIDATION_ERROR_MESSAGE = "入力内容を確認してください";

/** メール認証トークンの有効期間（ミリ秒） */
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** メール認証トークンのidentifier prefix */
const EMAIL_VERIFICATION_IDENTIFIER_PREFIX = "email-verification";

/** トークン検証スキーマ */
const VerifyEmailSchema = z.object({
  token: z.string({ required_error: "tokenは必須です" }).min(1, "tokenは必須です"),
});

/** createEmailVerificationRouteのオプション */
type EmailVerificationRouteOptions = {
  db: Database;
  appUrl: string;
};

/**
 * メール認証ルートを生成する
 *
 * POST /send-verification: 認証メールを送信する
 * POST /verify-email: トークンを検証してメールアドレスを認証済みにする
 *
 * @param options - DB インスタンスおよびアプリURL
 * @returns Hono ルーターインスタンス
 */
export function createEmailVerificationRoute(options: EmailVerificationRouteOptions) {
  const { db, appUrl } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.post("/send-verification", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_ERROR_CODE,
            message: AUTH_ERROR_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const userId = user.id as string;

    const [found] = await db.select().from(users).where(eq(users.id, userId));
    if (!found) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "ユーザーが見つかりません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const token = crypto.randomUUID();
    const identifier = `${EMAIL_VERIFICATION_IDENTIFIER_PREFIX}:${userId}`;
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString();

    await db.delete(verifications).where(eq(verifications.identifier, identifier));

    await db.insert(verifications).values({
      id: crypto.randomUUID(),
      identifier,
      value: token,
      expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const verifyUrl = `${appUrl}/verify-email?token=${token}`;
    const userName = (found as unknown as Record<string, unknown>).name as string | null;

    try {
      await sendEmailVerification(
        (found as unknown as Record<string, unknown>).email as string,
        userName ?? "",
        verifyUrl,
      );
    } catch (error) {
      logger.error("認証メール送信エラー", { userId, error });
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "認証メールの送信に失敗しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }

    return c.json(
      {
        success: true,
        data: { message: "認証メールを送信しました" },
      },
      HTTP_OK,
    );
  });

  route.post("/verify-email", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: [{ field: "", message: "リクエストボディが不正です" }],
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const validation = VerifyEmailSchema.safeParse(body);
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

    const { token } = validation.data;

    const [verification] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.value, token));

    if (!verification) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "無効なトークンです",
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    const verif = verification as unknown as Record<string, unknown>;
    const expiresAt = new Date(verif.expiresAt as string);
    if (expiresAt <= new Date()) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "トークンの有効期限が切れています",
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    const identifier = verif.identifier as string;
    const userId = identifier.replace(`${EMAIL_VERIFICATION_IDENTIFIER_PREFIX}:`, "");

    await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));

    await db.delete(verifications).where(eq(verifications.value, token));

    return c.json(
      {
        success: true,
        data: { message: "メールアドレスの認証が完了しました" },
      },
      HTTP_OK,
    );
  });

  return route;
}
