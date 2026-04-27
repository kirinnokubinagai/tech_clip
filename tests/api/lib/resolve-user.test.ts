import { resolveUserFromRequest } from "@api/lib/resolve-user";
import { describe, expect, it, vi } from "vitest";

/** テスト用ユーザー行 */
const TEST_USER = { id: "user-1", email: "test@example.com", name: "テストユーザー" };

/** テスト用トークン */
const VALID_TOKEN = "valid-bearer-token";

/** 有効期限（未来日時） */
const FUTURE_EXPIRES_AT = new Date(Date.now() + 3_600_000);

/** 有効期限切れ（過去日時） */
const PAST_EXPIRES_AT = new Date(Date.now() - 3_600_000);

/**
 * Auth モックを作成する
 */
function createMockAuth(sessionUser: { id: string } | null = null) {
  return {
    api: {
      getSession: vi.fn().mockResolvedValue(sessionUser ? { user: sessionUser } : null),
    },
  } as unknown as Parameters<typeof resolveUserFromRequest>[1];
}

/**
 * Auth モックを作成する（getSession が例外をスロー）
 */
function createMockAuthThrows() {
  return {
    api: {
      getSession: vi.fn().mockRejectedValue(new Error("Cookie parse error")),
    },
  } as unknown as Parameters<typeof resolveUserFromRequest>[1];
}

/**
 * Database モックを作成する（users クエリ用）
 */
function createMockDb(userRows: unknown[] = [], sessionRows: unknown[] = []) {
  let callCount = 0;
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve(userRows);
          return Promise.resolve(sessionRows);
        }),
      })),
    })),
  } as unknown as Parameters<typeof resolveUserFromRequest>[0];
}

/**
 * Bearer トークン専用の Database モック（sessions → users の順）
 */
function createMockDbForBearer(sessionRows: unknown[], userRows: unknown[]) {
  let callCount = 0;
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve(sessionRows);
          return Promise.resolve(userRows);
        }),
      })),
    })),
  } as unknown as Parameters<typeof resolveUserFromRequest>[0];
}

describe("resolveUserFromRequest", () => {
  describe("Cookie セッション（Better Auth）経由", () => {
    it("有効な Cookie セッションがある場合はユーザーを返すこと", async () => {
      // Arrange
      const auth = createMockAuth({ id: TEST_USER.id });
      const db = createMockDb([TEST_USER]);
      const headers = new Headers();

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toEqual(TEST_USER);
    });

    it("セッションのユーザーが DB に存在しない場合は Bearer にフォールバックすること", async () => {
      // Arrange
      const auth = createMockAuth({ id: "ghost-user" });
      const db = createMockDbForBearer([], []);
      const headers = new Headers();

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toBeNull();
    });

    it("getSession が例外をスローした場合は Bearer にフォールバックすること", async () => {
      // Arrange
      const auth = createMockAuthThrows();
      const headers = new Headers();
      const sessionRow = { token: VALID_TOKEN, userId: TEST_USER.id, expiresAt: FUTURE_EXPIRES_AT };
      const db = createMockDbForBearer([sessionRow], [TEST_USER]);
      headers.set("Authorization", `Bearer ${VALID_TOKEN}`);

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toEqual(TEST_USER);
    });
  });

  describe("Bearer トークン経由", () => {
    it("有効な Bearer トークンがある場合はユーザーを返すこと", async () => {
      // Arrange
      const auth = createMockAuth(null);
      const sessionRow = { token: VALID_TOKEN, userId: TEST_USER.id, expiresAt: FUTURE_EXPIRES_AT };
      const db = createMockDbForBearer([sessionRow], [TEST_USER]);
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${VALID_TOKEN}`);

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toEqual(TEST_USER);
    });

    it("小文字の authorization ヘッダーでも Bearer トークンを検証できること", async () => {
      // Arrange
      const auth = createMockAuth(null);
      const sessionRow = { token: VALID_TOKEN, userId: TEST_USER.id, expiresAt: FUTURE_EXPIRES_AT };
      const db = createMockDbForBearer([sessionRow], [TEST_USER]);
      const headers = new Headers();
      headers.set("authorization", `Bearer ${VALID_TOKEN}`);

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toEqual(TEST_USER);
    });

    it("セッションが存在しない場合は null を返すこと", async () => {
      // Arrange
      const auth = createMockAuth(null);
      const db = createMockDbForBearer([], []);
      const headers = new Headers();
      headers.set("Authorization", `Bearer unknown-token`);

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toBeNull();
    });

    it("セッションが有効期限切れ（Date オブジェクト）の場合は null を返すこと", async () => {
      // Arrange
      const auth = createMockAuth(null);
      const sessionRow = { token: VALID_TOKEN, userId: TEST_USER.id, expiresAt: PAST_EXPIRES_AT };
      const db = createMockDbForBearer([sessionRow], [TEST_USER]);
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${VALID_TOKEN}`);

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toBeNull();
    });

    it("セッションが有効期限切れ（ISO 文字列）の場合は null を返すこと", async () => {
      // Arrange
      const auth = createMockAuth(null);
      const sessionRow = {
        token: VALID_TOKEN,
        userId: TEST_USER.id,
        expiresAt: PAST_EXPIRES_AT.toISOString(),
      };
      const db = createMockDbForBearer([sessionRow], [TEST_USER]);
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${VALID_TOKEN}`);

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toBeNull();
    });

    it("有効なセッションだが対応ユーザーが DB にない場合は null を返すこと", async () => {
      // Arrange
      const auth = createMockAuth(null);
      const sessionRow = {
        token: VALID_TOKEN,
        userId: "deleted-user",
        expiresAt: FUTURE_EXPIRES_AT,
      };
      const db = createMockDbForBearer([sessionRow], []);
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${VALID_TOKEN}`);

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toBeNull();
    });
  });

  describe("認証なし", () => {
    it("Authorization ヘッダーがない場合は null を返すこと", async () => {
      // Arrange
      const auth = createMockAuth(null);
      const db = createMockDbForBearer([], []);
      const headers = new Headers();

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toBeNull();
    });

    it("Bearer 以外の Authorization スキームは null を返すこと", async () => {
      // Arrange
      const auth = createMockAuth(null);
      const db = createMockDbForBearer([], []);
      const headers = new Headers();
      headers.set("Authorization", "Basic dXNlcjpwYXNz");

      // Act
      const user = await resolveUserFromRequest(db, auth, headers);

      // Assert
      expect(user).toBeNull();
    });
  });
});
