/**
 * パスワード変更・リセット後のサインイン互換性統合テスト
 *
 * Better Auth がサインアップ時に使用する scrypt ハッシュ（better-auth/crypto の
 * hashPassword/verifyPassword）と、カスタムルートが auth.$context.password.hash/verify
 * 経由で生成するハッシュが完全に一致することを、実 SQLite DB を用いて検証する。
 *
 * 検証戦略:
 * - hashPassword / verifyPassword は Better Auth sign-in が使う関数と同一
 * - カスタムルートが auth.$context.password.hash を使うことで同じ scrypt 形式になることを確認する
 *
 * テスト対象フロー:
 * 1. scrypt ハッシュを DB に保存（Better Auth sign-up と同等）→ パスワード変更 →
 *    新ハッシュを verifyPassword で検証できること
 * 2. 同様のフローをパスワードリセットルートで検証
 */

import { rmSync } from "node:fs";

import { accounts, users, verifications } from "@api/db/schema/index";
import { createPasswordResetRoute } from "@api/routes/password-reset";
import { createUsersRoute } from "@api/routes/users";
import { createClient } from "@libsql/client";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/** テスト用のベース URL */
const BASE_URL = "http://localhost:8081";

/** テスト固定値 */
const TEST_EMAIL = "integration@example.com";
const TEST_USER_ID = "test-user-integration-01";
const OLD_PASSWORD = "OldPassword123";
const NEW_PASSWORD = "NewPassword456";
const WRONG_PASSWORD = "WrongPassword789";

/** パスワードリセットのidentifierプレフィックス */
const RESET_TOKEN_IDENTIFIER_PREFIX = "password-reset:";

/**
 * パスワードリセットトークンをハッシュ化する（password-reset.ts と同一実装）
 *
 * @param token - ハッシュ化するトークン文字列
 * @returns SHA-256 ハッシュの16進数文字列
 */
async function hashResetToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** テスト用の一時 SQLite DB を作成する */
function createTestDb() {
  const dbPath = `/tmp/password-compat-${crypto.randomUUID()}.db`;
  const client = createClient({ url: `file:${dbPath}` });
  const db = drizzle(client);
  return { db, dbPath, client };
}

/**
 * テスト用テーブルを作成する
 *
 * このSQLは @api/db/schema/index のスキーマと同期が必要。
 * スキーマ変更時は手動で更新すること。
 */
async function createTables(db: ReturnType<typeof drizzle>) {
  await db.run(
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, image TEXT, email_verified INTEGER DEFAULT 0, username TEXT UNIQUE, bio TEXT, website_url TEXT, github_username TEXT, twitter_username TEXT, avatar_url TEXT, is_profile_public INTEGER DEFAULT 1, preferred_language TEXT DEFAULT 'ja', is_premium INTEGER DEFAULT 0, premium_expires_at TEXT, free_ai_uses_remaining INTEGER DEFAULT 5, free_ai_reset_at TEXT, push_token TEXT, push_enabled INTEGER DEFAULT 1, is_test_account INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );
  await db.run(
    "CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, account_id TEXT NOT NULL, provider_id TEXT NOT NULL, access_token TEXT, refresh_token TEXT, access_token_expires_at TEXT, refresh_token_expires_at TEXT, scope TEXT, id_token TEXT, password TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );
  await db.run(
    "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );
  await db.run(
    "CREATE TABLE IF NOT EXISTS verifications (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))",
  );
}

/**
 * Better Auth の scrypt 互換ハッシュでユーザーを DB に挿入する
 *
 * これは Better Auth が sign-up 時に行うのと同等の操作である。
 * hashPassword は better-auth/crypto からエクスポートされており、
 * Better Auth のサインアップ・サインインが内部で使用するものと同一の関数。
 */
async function insertUserWithScryptHash(
  db: ReturnType<typeof drizzle>,
  userId: string,
  email: string,
  password: string,
) {
  const scryptHash = await hashPassword(password);
  await db.insert(users).values({ id: userId, email, name: "テストユーザー" });
  await db.insert(accounts).values({
    id: `account-${userId}`,
    userId,
    accountId: userId,
    providerId: "credential",
    password: scryptHash,
  });
  return scryptHash;
}

/**
 * auth.$context.password を使う mockAuth を生成する
 *
 * DB アダプタのセットアップを省略し、$context.password の
 * hash/verify のみを実際の better-auth/crypto 実装にバインドする。
 * これにより、カスタムルートが auth.$context を経由して scrypt を使うことを検証できる。
 */
function createMockAuthWithRealCrypto() {
  return {
    $context: Promise.resolve({
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    }),
  };
}

/**
 * ユーザールートのテスト用アプリを構築する
 *
 * user コンテキストを直接セットするシンプルなミドルウェアを使用する。
 */
function buildUsersApp(db: ReturnType<typeof drizzle>, userId: string) {
  const mockAuth = createMockAuthWithRealCrypto();
  const usersRoute = createUsersRoute({ db: db as never, auth: mockAuth as never });
  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  app.use("*", async (c, next) => {
    c.set("user", { id: userId });
    await next();
  });

  app.route("/api/users", usersRoute);
  return app;
}

/**
 * パスワードリセットルートのテスト用アプリを構築する
 */
function buildPasswordResetApp(db: ReturnType<typeof drizzle>) {
  const mockAuth = createMockAuthWithRealCrypto();
  const resetRoute = createPasswordResetRoute({
    db: db as never,
    appUrl: BASE_URL,
    emailEnv: { RESEND_API_KEY: "test-key", FROM_EMAIL: "noreply@test.com" },
    auth: mockAuth as never,
  });
  const app = new Hono();
  app.route("/api/auth", resetRoute);
  return app;
}

describe("パスワード変更ルートの scrypt 互換性統合テスト", () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(async () => {
    testDb = createTestDb();
    await createTables(testDb.db);
    await insertUserWithScryptHash(testDb.db, TEST_USER_ID, TEST_EMAIL, OLD_PASSWORD);
  });

  afterEach(() => {
    testDb.client.close();
    rmSync(testDb.dbPath, { force: true });
  });

  describe("PATCH /me/password: パスワード変更フロー", () => {
    it("パスワード変更後のハッシュを verifyPassword で検証できること", async () => {
      // Arrange: scrypt ハッシュで保存済みの DB + 実ルート
      const app = buildUsersApp(testDb.db, TEST_USER_ID);

      // Act: パスワード変更（auth.$context.password.hash/verify を使用）
      const changeRes = await app.request("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: OLD_PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
      });

      // Assert: パスワード変更成功
      expect(changeRes.status).toBe(200);
      const changeBody = (await changeRes.json()) as { success: boolean };
      expect(changeBody.success).toBe(true);

      // Assert: DB の新パスワードハッシュを Better Auth sign-in 互換の verifyPassword で検証できること
      const [account] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, TEST_USER_ID));

      const storedHash = account?.password ?? "";
      expect(storedHash).toBeTruthy();
      const isNewPasswordValid = await verifyPassword({
        hash: storedHash,
        password: NEW_PASSWORD,
      });
      expect(isNewPasswordValid).toBe(true);
    });

    it("パスワード変更後に旧パスワードは検証できないこと（ハッシュ互換性確認）", async () => {
      // Arrange
      const app = buildUsersApp(testDb.db, TEST_USER_ID);

      // Act: パスワード変更
      await app.request("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: OLD_PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
      });

      // Assert: 旧パスワードは verifyPassword で検証できないこと
      const [account] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, TEST_USER_ID));

      const storedHash = account?.password ?? "";
      const isOldPasswordValid = await verifyPassword({
        hash: storedHash,
        password: OLD_PASSWORD,
      });
      expect(isOldPasswordValid).toBe(false);
    });

    it("誤ったパスワードで変更しようとすると401が返ること", async () => {
      // Arrange
      const app = buildUsersApp(testDb.db, TEST_USER_ID);

      // Act: 誤ったcurrentPasswordでパスワード変更試行
      const changeRes = await app.request("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: WRONG_PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
      });

      // Assert: 認証エラー
      expect(changeRes.status).toBe(401);
    });

    it("パスワード変更後のハッシュが scrypt 形式（salt:hash）であること", async () => {
      // Arrange
      const app = buildUsersApp(testDb.db, TEST_USER_ID);

      // Act: パスワード変更
      await app.request("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: OLD_PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
      });

      // Assert: ハッシュが scrypt 形式（"saltHex:hashHex"）であること
      const [account] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, TEST_USER_ID));

      const storedHash = account?.password ?? "";
      expect(storedHash).toBeTruthy();
      const hashParts = storedHash.split(":");

      // scrypt 形式: saltHex:hashHex（2パーツ）
      // PBKDF2 形式: pbkdf2:iterations:saltHex:hashHex（4パーツ）
      expect(hashParts).toHaveLength(2);
      expect(hashParts[0]).not.toBe("pbkdf2");
    });
  });

  describe("POST /reset-password: パスワードリセットフロー", () => {
    it("パスワードリセット後のハッシュを verifyPassword で検証できること", async () => {
      // Arrange: リセットトークンを DB に直接挿入（メール送信をスキップ）
      const rawToken = crypto.randomUUID();
      const hashedToken = await hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

      await testDb.db.insert(verifications).values({
        id: crypto.randomUUID(),
        identifier: `${RESET_TOKEN_IDENTIFIER_PREFIX}${TEST_EMAIL}`,
        value: hashedToken,
        expiresAt,
      });

      const app = buildPasswordResetApp(testDb.db);

      // Act: パスワードリセット（auth.$context.password.hash を使用）
      const resetRes = await app.request("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken, password: NEW_PASSWORD }),
      });

      // Assert: リセット成功
      expect(resetRes.status).toBe(200);
      const resetBody = (await resetRes.json()) as { success: boolean };
      expect(resetBody.success).toBe(true);

      // Assert: DB の新パスワードハッシュを Better Auth sign-in 互換の verifyPassword で検証できること
      const [account] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, TEST_USER_ID));

      const storedHash = account?.password ?? "";
      expect(storedHash).toBeTruthy();
      const isNewPasswordValid = await verifyPassword({
        hash: storedHash,
        password: NEW_PASSWORD,
      });
      expect(isNewPasswordValid).toBe(true);
    });

    it("パスワードリセット後のハッシュが scrypt 形式（salt:hash）であること", async () => {
      // Arrange
      const rawToken = crypto.randomUUID();
      const hashedToken = await hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

      await testDb.db.insert(verifications).values({
        id: crypto.randomUUID(),
        identifier: `${RESET_TOKEN_IDENTIFIER_PREFIX}${TEST_EMAIL}`,
        value: hashedToken,
        expiresAt,
      });

      const app = buildPasswordResetApp(testDb.db);

      // Act: パスワードリセット
      await app.request("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken, password: NEW_PASSWORD }),
      });

      // Assert: ハッシュが scrypt 形式（"saltHex:hashHex"）であること（PBKDF2 ではないこと）
      const [account] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, TEST_USER_ID));

      const storedHash = account?.password ?? "";
      expect(storedHash).toBeTruthy();
      const hashParts = storedHash.split(":");
      expect(hashParts).toHaveLength(2);
      expect(hashParts[0]).not.toBe("pbkdf2");
    });

    it("パスワードリセット後に旧パスワードは検証できないこと", async () => {
      // Arrange
      const rawToken = crypto.randomUUID();
      const hashedToken = await hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

      await testDb.db.insert(verifications).values({
        id: crypto.randomUUID(),
        identifier: `${RESET_TOKEN_IDENTIFIER_PREFIX}${TEST_EMAIL}`,
        value: hashedToken,
        expiresAt,
      });

      const app = buildPasswordResetApp(testDb.db);

      // Act: パスワードリセット
      await app.request("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken, password: NEW_PASSWORD }),
      });

      // Assert: 旧パスワードは検証できないこと
      const [account] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, TEST_USER_ID));

      const storedHash = account?.password ?? "";
      const isOldPasswordValid = await verifyPassword({
        hash: storedHash,
        password: OLD_PASSWORD,
      });
      expect(isOldPasswordValid).toBe(false);
    });
  });

  describe("scrypt 形式互換性: hashPassword と auth.$context.password.hash の一致確認", () => {
    it("hashPassword で生成したハッシュを verifyPassword で検証できること（Better Auth 内部一貫性）", async () => {
      // Arrange: hashPassword が生成するハッシュ形式を確認
      const hash = await hashPassword(OLD_PASSWORD);

      // Assert: scrypt 形式（salt:hash）
      const parts = hash.split(":");
      expect(parts).toHaveLength(2);

      // Assert: verifyPassword（Better Auth sign-in が使用）で検証できること
      const isValid = await verifyPassword({ hash, password: OLD_PASSWORD });
      expect(isValid).toBe(true);
    });

    it("初期ハッシュ（scrypt）がパスワード変更後も同形式で保存されること", async () => {
      // Arrange: DB に保存された初期ハッシュを確認
      const [initialAccount] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, TEST_USER_ID));

      const initialHash = initialAccount?.password ?? "";
      const initialHashParts = initialHash.split(":");
      expect(initialHashParts).toHaveLength(2);

      // Act: パスワード変更
      const app = buildUsersApp(testDb.db, TEST_USER_ID);
      await app.request("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: OLD_PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
      });

      // Assert: 変更後も scrypt 形式（salt:hash）が維持されること
      const [updatedAccount] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, TEST_USER_ID));

      const updatedHash = updatedAccount?.password ?? "";
      const updatedHashParts = updatedHash.split(":");
      expect(updatedHashParts).toHaveLength(2);
      expect(updatedHashParts[0]).not.toBe("pbkdf2");
    });
  });
});

describe("パスワード変更ルートの認証チェック（統合テスト）", () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(async () => {
    testDb = createTestDb();
    await createTables(testDb.db);
    await insertUserWithScryptHash(testDb.db, TEST_USER_ID, TEST_EMAIL, OLD_PASSWORD);
  });

  afterEach(() => {
    testDb.client.close();
    rmSync(testDb.dbPath, { force: true });
  });

  it("credential アカウントがない場合にパスワード変更すると401が返ること", async () => {
    // Arrange: credential アカウントなしのユーザーを別途作成
    const noCredUserId = "no-cred-user-01";
    await testDb.db.insert(users).values({
      id: noCredUserId,
      email: "no-cred@example.com",
      name: "ノークレデンシャル",
    });
    await testDb.db.insert(accounts).values({
      id: `oauth-${noCredUserId}`,
      userId: noCredUserId,
      accountId: noCredUserId,
      providerId: "google", // OAuth のみ
      password: null,
    });

    const app = buildUsersApp(testDb.db, noCredUserId);

    // Act: パスワード変更試行
    const res = await app.request("/api/users/me/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    });

    // Assert: 認証エラー（credential なし）
    expect(res.status).toBe(401);
  });
});
