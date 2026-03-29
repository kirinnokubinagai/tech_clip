import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { sessions, users } from "../db/schema";

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** 未認証エラーコード */
const AUTH_REQUIRED_CODE = "AUTH_REQUIRED";

/** 認証情報不正エラーコード */
const AUTH_INVALID_CODE = "AUTH_INVALID";

/** バリデーションエラーコード */
const VALIDATION_FAILED_CODE = "VALIDATION_FAILED";

/** サーバーエラーコード */
const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";

/** セッション期限切れエラーコード */
const AUTH_EXPIRED_CODE = "AUTH_EXPIRED";

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

/** サインインリクエストのスキーマ */
const SignInSchema = z.object({
  email: z
    .string({ required_error: "メールアドレスは必須です" })
    .email("メールアドレスの形式が正しくありません"),
  password: z
    .string({ required_error: "パスワードは必須です" })
    .min(1, "パスワードを入力してください"),
});

/** リフレッシュリクエストのスキーマ */
const RefreshSchema = z.object({
  refreshToken: z
    .string({ required_error: "リフレッシュトークンは必須です" })
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

      if (!result || !result.token) {
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

      const [sessionRow] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.token, result.token));

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

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
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
   * リフレッシュトークン（セッショントークン）が有効であれば同じトークンを返す
   * セッションの有効期限を確認し、期限切れの場合は 401 を返す
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
      const [sessionRow] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.token, parsed.data.refreshToken));

      if (!sessionRow) {
        return c.json(
          {
            success: false,
            error: {
              code: AUTH_EXPIRED_CODE,
              message: "セッションの有効期限が切れました。再度ログインしてください",
            },
          },
          HTTP_UNAUTHORIZED,
        );
      }

      const expiresAt = new Date(sessionRow.expiresAt);
      if (expiresAt <= new Date()) {
        return c.json(
          {
            success: false,
            error: {
              code: AUTH_EXPIRED_CODE,
              message: "セッションの有効期限が切れました。再度ログインしてください",
            },
          },
          HTTP_UNAUTHORIZED,
        );
      }

      const [userRow] = await db
        .select()
        .from(users)
        .where(eq(users.id, sessionRow.userId));

      if (!userRow) {
        return c.json(
          {
            success: false,
            error: {
              code: AUTH_EXPIRED_CODE,
              message: "セッションの有効期限が切れました。再度ログインしてください",
            },
          },
          HTTP_UNAUTHORIZED,
        );
      }

      return c.json(
        {
          success: true,
          data: {
            token: sessionRow.token,
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

  return app;
}
