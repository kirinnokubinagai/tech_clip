import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { refreshTokens, sessions, users } from "../db/schema";
import {
  AUTH_EXPIRED_CODE,
  AUTH_INVALID_CODE,
  AUTH_ERROR_CODE as AUTH_REQUIRED_CODE,
  INTERNAL_ERROR_CODE,
  VALIDATION_ERROR_CODE as VALIDATION_FAILED_CODE,
} from "../lib/error-codes";
import {
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";

/**
 * Better Auth インスタンスの型定義
 */
type AuthInstance = {
  api: {
    signInEmail: (options: {
      body: { email: string; password: string };
      headers?: Headers;
    }) => Promise<{
      token: string | null;
      user: Record<string, unknown>;
    } | null>;
    getSession: (options: { headers: Headers }) => Promise<{
      session: { token: string; expiresAt: Date | string };
      user: Record<string, unknown>;
    } | null>;
  };
};

/**
 * 認証ルートのファクトリ関数の引数
 */
type AuthRouteOptions = {
  db: Database;
  getAuth: () => AuthInstance;
};

/** リフレッシュトークンの文字数 */
const REFRESH_TOKEN_LENGTH = 48;

/**
 * リフレッシュトークンを SHA-256 でハッシュ化する
 *
 * @param token - 平文のリフレッシュトークン
 * @returns 16進文字列のハッシュ値
 */
async function hashRefreshToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * ランダムなリフレッシュトークン文字列を生成する
 *
 * @returns 平文のリフレッシュトークン
 */
function generateRefreshToken(): string {
  const bytes = new Uint8Array(REFRESH_TOKEN_LENGTH / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * セッションに紐づくリフレッシュトークンを発行して保存する
 *
 * @param db - データベース接続
 * @param session - セッション情報
 * @returns クライアントへ返す平文のリフレッシュトークン
 */
async function createRefreshTokenRecord(
  db: Database,
  session: { id: string; userId: string; expiresAt: string },
): Promise<string> {
  const refreshToken = generateRefreshToken();
  const tokenHash = await hashRefreshToken(refreshToken);

  await db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    sessionId: session.id,
    userId: session.userId,
    tokenHash,
    expiresAt: session.expiresAt,
  });

  return refreshToken;
}

/** サインインリクエストのスキーマ */
const SignInSchema = z.object({
  email: z
    .string({ error: "メールアドレスは必須です" })
    .email("メールアドレスの形式が正しくありません"),
  password: z.string({ error: "パスワードは必須です" }).min(1, "パスワードを入力してください"),
});

/** リフレッシュリクエストのスキーマ */
const RefreshSchema = z.object({
  refreshToken: z
    .string({ error: "リフレッシュトークンは必須です" })
    .min(1, "リフレッシュトークンを入力してください"),
});

/**
 * 認証関連ルートを生成する
 *
 * @param options - DB インスタンスと Better Auth ファクトリ
 * @returns Hono ルーター
 */
export function createAuthRoute({ db, getAuth }: AuthRouteOptions) {
  const app = new Hono();

  /**
   * サインイン
   * Better Auth の signInEmail API をラップして統一レスポンス形式で返す
   */
  app.post("/sign-in", async (c) => {
    const body: unknown = await c.req.json().catch(() => ({}));
    const parsed = SignInSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_FAILED_CODE,
            message: "入力内容を確認してください",
            details: parsed.error.issues.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    try {
      const auth = getAuth();
      const result = await auth.api.signInEmail({
        body: { email: parsed.data.email, password: parsed.data.password },
      });

      if (!result?.token) {
        return c.json(
          {
            success: false,
            error: {
              code: AUTH_INVALID_CODE,
              message: "認証情報が正しくありません",
            },
          },
          HTTP_UNAUTHORIZED,
        );
      }

      const [sessionRow] = await db.select().from(sessions).where(eq(sessions.token, result.token));

      if (!sessionRow) {
        return c.json(
          {
            success: false,
            error: {
              code: AUTH_INVALID_CODE,
              message: "認証情報が正しくありません",
            },
          },
          HTTP_UNAUTHORIZED,
        );
      }

      const user = result.user;
      const refreshToken = await createRefreshTokenRecord(db, {
        id: sessionRow.id,
        userId: sessionRow.userId,
        expiresAt: sessionRow.expiresAt,
      });

      return c.json(
        {
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image ?? null,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
            session: {
              token: sessionRow.token,
              refreshToken,
              expiresAt: sessionRow.expiresAt,
            },
          },
        },
        HTTP_OK,
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_INVALID_CODE,
            message: "認証情報が正しくありません",
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }
  });

  /**
   * セッション確認
   * Authorization: Bearer <token> ヘッダーからセッションを検証して返す
   */
  app.get("/session", async (c) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_REQUIRED_CODE,
            message: "ログインが必要です",
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    try {
      const auth = getAuth();
      const result = await auth.api.getSession({ headers: c.req.raw.headers });

      if (!result) {
        return c.json(
          {
            success: false,
            error: {
              code: AUTH_REQUIRED_CODE,
              message: "ログインが必要です",
            },
          },
          HTTP_UNAUTHORIZED,
        );
      }

      const user = result.user;
      const session = result.session;
      const expiresAt =
        session.expiresAt instanceof Date
          ? session.expiresAt.toISOString()
          : String(session.expiresAt);

      return c.json(
        {
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image ?? null,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
            session: {
              token: session.token,
              expiresAt,
            },
          },
        },
        HTTP_OK,
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: INTERNAL_ERROR_CODE,
            message: "サーバーエラーが発生しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  /**
   * トークンリフレッシュ
   * リフレッシュトークンが有効であれば現在のアクセストークンを返し、
   * リフレッシュトークンは毎回ローテーションする
   */
  app.post("/refresh", async (c) => {
    const body: unknown = await c.req.json().catch(() => ({}));
    const parsed = RefreshSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_FAILED_CODE,
            message: "入力内容を確認してください",
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    try {
      const refreshTokenHash = await hashRefreshToken(parsed.data.refreshToken);

      const result = await db.transaction(async (tx) => {
        const [refreshTokenRow] = await tx
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, refreshTokenHash));

        if (!refreshTokenRow) {
          return {
            error: {
              code: AUTH_EXPIRED_CODE,
              message: "セッションの有効期限が切れました。再度ログインしてください",
            },
          } as const;
        }

        const [sessionRow] = await tx
          .select()
          .from(sessions)
          .where(eq(sessions.id, refreshTokenRow.sessionId));

        if (!sessionRow) {
          return {
            error: {
              code: AUTH_EXPIRED_CODE,
              message: "セッションの有効期限が切れました。再度ログインしてください",
            },
          } as const;
        }

        const refreshExpiresAt = new Date(refreshTokenRow.expiresAt);
        const expiresAt = new Date(sessionRow.expiresAt);
        if (refreshExpiresAt <= new Date() || expiresAt <= new Date()) {
          return {
            error: {
              code: AUTH_EXPIRED_CODE,
              message: "セッションの有効期限が切れました。再度ログインしてください",
            },
          } as const;
        }

        const [userRow] = await tx.select().from(users).where(eq(users.id, sessionRow.userId));

        if (!userRow) {
          return {
            error: {
              code: AUTH_EXPIRED_CODE,
              message: "セッションの有効期限が切れました。再度ログインしてください",
            },
          } as const;
        }

        const nextRefreshToken = generateRefreshToken();
        const nextRefreshTokenHash = await hashRefreshToken(nextRefreshToken);

        await tx
          .update(refreshTokens)
          .set({
            tokenHash: nextRefreshTokenHash,
            expiresAt: sessionRow.expiresAt,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(refreshTokens.id, refreshTokenRow.id));

        return {
          data: {
            token: sessionRow.token,
            refreshToken: nextRefreshToken,
          },
        } as const;
      });

      if ("error" in result) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          HTTP_UNAUTHORIZED,
        );
      }

      return c.json(
        {
          success: true,
          data: result.data,
        },
        HTTP_OK,
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: INTERNAL_ERROR_CODE,
            message: "サーバーエラーが発生しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  return app;
}
