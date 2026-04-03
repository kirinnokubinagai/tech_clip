import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../db";
import { accounts, users } from "../db/schema";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  AUTH_INVALID_CODE,
  AUTH_INVALID_MESSAGE,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from "../lib/error-codes";
import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NO_CONTENT,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import { uploadAvatarToR2, validateImageFile } from "../services/imageUpload";

/** 名前最大文字数 */
const NAME_MAX_LENGTH = 100;

/** ユーザー名最大文字数 */
const USERNAME_MAX_LENGTH = 30;

/** 自己紹介最大文字数 */
const BIO_MAX_LENGTH = 500;

/** URL最大文字数 */
const URL_MAX_LENGTH = 2048;

/** GitHubユーザー名最大文字数 */
const GITHUB_USERNAME_MAX_LENGTH = 39;

/** Twitterユーザー名最大文字数 */
const TWITTER_USERNAME_MAX_LENGTH = 15;

/** ユーザー名の正規表現（半角英数字とアンダースコア、ハイフンのみ） */
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

/** パスワード最小文字数 */
const PASSWORD_MIN_LENGTH = 8;

/** パスワード最大文字数 */
const PASSWORD_MAX_LENGTH = 128;

/** PBKDF2 イテレーション回数 */
const PBKDF2_ITERATIONS = 100000;

/** パスワード変更成功メッセージ */
const PASSWORD_CHANGE_SUCCESS_MESSAGE = "パスワードを変更しました。";

/** パスワード変更スキーマ */
const ChangePasswordSchema = z.object({
  currentPassword: z
    .string({ error: "現在のパスワードは必須です" })
    .min(1, "現在のパスワードは必須です"),
  newPassword: z
    .string({ error: "新しいパスワードは必須です" })
    .min(PASSWORD_MIN_LENGTH, `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`)
    .max(PASSWORD_MAX_LENGTH, `パスワードは${PASSWORD_MAX_LENGTH}文字以内で入力してください`),
});

/** レスポンスから除外する機密フィールド */
const SENSITIVE_FIELDS = [
  "pushToken",
  "pushEnabled",
  "freeAiUsesRemaining",
  "freeAiResetAt",
  "premiumExpiresAt",
] as const;

/** プロフィール更新スキーマ */
const UpdateProfileSchema = z.object({
  name: z
    .string()
    .max(NAME_MAX_LENGTH, `名前は${NAME_MAX_LENGTH}文字以内で入力してください`)
    .trim()
    .nullable()
    .optional(),
  username: z
    .string()
    .max(USERNAME_MAX_LENGTH, `ユーザー名は${USERNAME_MAX_LENGTH}文字以内で入力してください`)
    .regex(USERNAME_REGEX, "ユーザー名は半角英数字、アンダースコア、ハイフンのみ使用できます")
    .nullable()
    .optional(),
  bio: z
    .string()
    .max(BIO_MAX_LENGTH, `自己紹介は${BIO_MAX_LENGTH}文字以内で入力してください`)
    .nullable()
    .optional(),
  websiteUrl: z
    .string()
    .max(URL_MAX_LENGTH, `URLは${URL_MAX_LENGTH}文字以内で入力してください`)
    .url("URLの形式が正しくありません")
    .nullable()
    .optional(),
  githubUsername: z
    .string()
    .max(
      GITHUB_USERNAME_MAX_LENGTH,
      `GitHubユーザー名は${GITHUB_USERNAME_MAX_LENGTH}文字以内で入力してください`,
    )
    .nullable()
    .optional(),
  twitterUsername: z
    .string()
    .max(
      TWITTER_USERNAME_MAX_LENGTH,
      `Twitterユーザー名は${TWITTER_USERNAME_MAX_LENGTH}文字以内で入力してください`,
    )
    .nullable()
    .optional(),
  isProfilePublic: z.boolean().optional(),
  preferredLanguage: z.string().optional(),
});

/** createUsersRouteのオプション */
type UsersRouteOptions = {
  db: Database;
  r2Bucket?: R2Bucket;
  r2PublicUrl?: string;
};

/**
 * レスポンスから機密フィールドを除外する
 *
 * @param user - ユーザーデータ
 * @returns 機密情報を除いたユーザーデータ
 */
function omitSensitiveFields(user: Record<string, unknown>): Record<string, unknown> {
  const result = { ...user };
  for (const field of SENSITIVE_FIELDS) {
    delete result[field];
  }
  return result;
}

/**
 * ユーザールートを生成する
 *
 * GET /me: 自分のプロフィール取得
 * PATCH /me: 自分のプロフィール更新
 * POST /me/avatar: アバター画像アップロード
 *
 * @param options - DB インスタンスおよびR2設定
 * @returns Hono ルーターインスタンス
 */
export function createUsersRoute(options: UsersRouteOptions) {
  const { db, r2Bucket, r2PublicUrl } = options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.get("/me", async (c) => {
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

    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id as string));

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

    return c.json({
      success: true,
      data: omitSensitiveFields(found as unknown as Record<string, unknown>),
    });
  });

  route.patch("/me", async (c) => {
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

    const body = await c.req.json().catch(() => ({}));
    const validation = UpdateProfileSchema.safeParse(body);

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

    const updateData = validation.data;

    if (Object.keys(updateData).length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: VALIDATION_ERROR_MESSAGE,
            details: [{ field: "", message: "更新するフィールドを指定してください" }],
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    if (updateData.username !== undefined && updateData.username !== null) {
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.username, updateData.username));

      if (existing && (existing as unknown as Record<string, unknown>).id !== userId) {
        return c.json(
          {
            success: false,
            error: {
              code: "DUPLICATE",
              message: "このユーザー名はすでに使用されています",
            },
          },
          HTTP_CONFLICT,
        );
      }
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    return c.json({
      success: true,
      data: omitSensitiveFields(updated as unknown as Record<string, unknown>),
    });
  });

  route.post("/me/avatar", async (c) => {
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

    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "リクエストの解析に失敗しました",
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    const avatarField = formData.get("avatar");
    if (!avatarField || typeof avatarField === "string") {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "avatarフィールドにファイルを指定してください",
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    const validation = validateImageFile(avatarField);
    if (!validation.isValid) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: validation.error ?? "ファイル形式が正しくありません",
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    if (!r2Bucket || !r2PublicUrl) {
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

    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    const oldAvatarUrl = (currentUser as unknown as Record<string, unknown>)?.avatarUrl as
      | string
      | null
      | undefined;

    let avatarUrl: string;
    try {
      const result = await uploadAvatarToR2({
        file: avatarField,
        userId,
        config: { r2Bucket, r2PublicUrl },
      });
      avatarUrl = result.avatarUrl;
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "アバター画像のアップロードに失敗しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }

    if (oldAvatarUrl) {
      const oldKey = oldAvatarUrl.replace(`${r2PublicUrl}/`, "");
      await r2Bucket.delete(oldKey).catch((err) => {
        console.warn("旧アバター画像の削除に失敗しました", { oldKey, error: err });
      });
    }

    const [updated] = await db
      .update(users)
      .set({ avatarUrl })
      .where(eq(users.id, userId))
      .returning();

    return c.json({
      success: true,
      data: omitSensitiveFields(updated as unknown as Record<string, unknown>),
    });
  });

  route.patch("/me/password", async (c) => {
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

    const body = await c.req.json().catch(() => ({}));
    const validation = ChangePasswordSchema.safeParse(body);

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

    const { currentPassword, newPassword } = validation.data;

    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));

    if (!account || !account.password) {
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

    const isValid = await verifyPassword(currentPassword, account.password);

    if (!isValid) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_INVALID_CODE,
            message: AUTH_INVALID_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const hashedNewPassword = await hashPasswordPbkdf2(newPassword);

    await db
      .update(accounts)
      .set({ password: hashedNewPassword })
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));

    return c.json(
      {
        success: true,
        data: { message: PASSWORD_CHANGE_SUCCESS_MESSAGE },
      },
      HTTP_OK,
    );
  });

  route.delete("/me", async (c) => {
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

    try {
      await db.transaction(async (tx) => {
        await tx.delete(users).where(eq(users.id, userId));
      });
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "アカウントの削除に失敗しました",
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }

    return new Response(null, { status: HTTP_NO_CONTENT });
  });

  return route;
}

/**
 * パスワードをPBKDF2でハッシュ化する
 *
 * Web Crypto API を使用する。Cloudflare Workers 環境でも動作する。
 *
 * @param password - ハッシュ化する平文パスワード
 * @returns ハッシュ化されたパスワード文字列（pbkdf2:iterations:saltHex:hashHex 形式）
 */
async function hashPasswordPbkdf2(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

/**
 * 平文パスワードと保存済みハッシュを照合する
 *
 * @param plainPassword - 照合する平文パスワード
 * @param storedHash - 保存済みハッシュ（pbkdf2:iterations:saltHex:hashHex 形式）
 * @returns 照合成功の場合 true
 */
async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return false;
  }

  const iterations = Number(parts[1]);
  const saltHex = parts[2];
  const expectedHashHex = parts[3];

  if (!Number.isInteger(iterations) || iterations <= 0 || !saltHex || !expectedHashHex) {
    return false;
  }

  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
  );

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(plainPassword),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex === expectedHashHex;
}
