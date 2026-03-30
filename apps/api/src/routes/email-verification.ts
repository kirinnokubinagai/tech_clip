import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { users, verifications } from "../db/schema";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from "../lib/error-codes";
import {
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import { createLogger } from "../lib/logger";
import type { EmailEnv } from "../services/emailService";
import { sendEmailVerification } from "../services/emailService";

const logger = createLogger();

/** メール認証トークンの有効期間（ミリ秒） */
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** メール認証トークンのidentifier prefix */
const EMAIL_VERIFICATION_IDENTIFIER_PREFIX = "email-verification";

/** トークン検証スキーマ */
const VerifyEmailSchema = z.object({
  token: z.string({ error: "tokenは必須です" }).min(1, "tokenは必須です"),
});

/** createEmailVerificationRouteのオプション */
type EmailVerificationRouteOptions = {
  db: Database;
  appUrl: string;
  emailEnv: EmailEnv;
};

/**
 * メール認証用トークンをSHA-256でハッシュ化する
 *
 * Web Crypto API (SubtleCrypto) を使用してハッシュ化する。
 * Cloudflare Workers 環境でも動作する。
 *
 * @param token - ハッシュ化するトークン文字列
 * @returns ハッシュ化された16進数文字列
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
  const { db, appUrl, emailEnv } = options;
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

    const rawToken = crypto.randomUUID();
    const hashedToken = await hashToken(rawToken);
    const identifier = `${EMAIL_VERIFICATION_IDENTIFIER_PREFIX}:${userId}`;
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString();

    await db.delete(verifications).where(eq(verifications.identifier, identifier));

    await db.insert(verifications).values({
      id: crypto.randomUUID(),
      identifier,
      value: hashedToken,
      expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;
    const userName = (found as unknown as Record<string, unknown>).name as string | null;

    try {
      await sendEmailVerification(
        emailEnv,
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
    const hashedToken = await hashToken(token);

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

    await db.delete(verifications).where(eq(verifications.id, verification.id));

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
