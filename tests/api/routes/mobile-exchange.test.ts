import type { Database } from "@api/db";
import { createAuthRoute } from "@api/routes/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** 有効な 64 文字の hex exchange code */
const VALID_CODE = "a".repeat(64);

/** テスト用セッション行 */
const MOCK_SESSION_ROW = {
  id: "session_01",
  userId: "user_01",
  token: "session-token-abc123",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  ipAddress: null,
  userAgent: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** テスト用 exchange code 行（未消費） */
function createMockExchangeRow(
  overrides: Partial<{
    consumedAt: string | null;
    expiresAt: string;
  }> = {},
) {
  return {
    id: "exchange_01",
    codeHash: "hashed_code",
    sessionId: "session_01",
    userId: "user_01",
    sessionToken: "session-token-abc123",
    refreshTokenPlain: "refresh-token-plain-abc",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    consumedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

type ExchangeRow = ReturnType<typeof createMockExchangeRow>;

/**
 * DB モックを構築する。
 * transaction コールバック内の各 select は引数の exchangeRow / sessionRow を返す。
 */
function createMockDb(opts: {
  exchangeRow: ExchangeRow | null;
  sessionRow?: typeof MOCK_SESSION_ROW | null;
  updateReturning?: { id: string }[];
}) {
  const {
    exchangeRow,
    sessionRow = MOCK_SESSION_ROW,
    updateReturning = [{ id: "exchange_01" }],
  } = opts;

  const mockReturning = vi.fn().mockResolvedValue(updateReturning);
  const mockWhere2 = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere2 });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  const mockDeleteWhere = vi.fn().mockResolvedValue([]);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

  const mockTransaction = vi
    .fn()
    .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      // Each transaction gets a fresh select call counter
      let callCount = 0;
      const txSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve(exchangeRow ? [exchangeRow] : []);
            }
            return Promise.resolve(sessionRow ? [sessionRow] : []);
          }),
        }),
      });

      const tx = {
        select: txSelect,
        update: mockUpdate,
        delete: mockDelete,
      };
      return cb(tx);
    });

  return {
    db: { transaction: mockTransaction } as unknown as Database,
    mockUpdate,
    mockReturning,
    mockDelete,
    mockDeleteWhere,
  };
}

async function callMobileExchange(db: Database, body: unknown): Promise<Response> {
  const getAuth = vi.fn();
  const route = createAuthRoute({ db, getAuth });
  const { Hono } = await import("hono");
  const app = new Hono();
  app.route("/", route);
  return app.fetch(
    new Request("https://api.example.com/mobile-exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /mobile-exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("有効な code で 200 と session.token・refreshToken を返すこと", async () => {
      // Arrange
      const { db } = createMockDb({ exchangeRow: createMockExchangeRow() });

      // Act
      const response = await callMobileExchange(db, { code: VALID_CODE });

      // Assert
      expect(response.status).toBe(200);
      const json = (await response.json()) as {
        success: boolean;
        data?: { session?: { token: string }; refreshToken: string };
      };
      expect(json.success).toBe(true);
      expect(json.data?.session?.token).toBe("session-token-abc123");
      expect(json.data?.refreshToken).toBe("refresh-token-plain-abc");
    });
  });

  describe("異常系", () => {
    it("期限切れ code は 401 を返すこと", async () => {
      // Arrange
      const { db } = createMockDb({
        exchangeRow: createMockExchangeRow({
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        }),
      });

      // Act
      const response = await callMobileExchange(db, { code: VALID_CODE });

      // Assert
      expect(response.status).toBe(401);
    });

    it("consumed_at セット済み code は 401 を返すこと", async () => {
      // Arrange
      const { db } = createMockDb({
        exchangeRow: createMockExchangeRow({
          consumedAt: new Date().toISOString(),
        }),
      });

      // Act
      const response = await callMobileExchange(db, { code: VALID_CODE });

      // Assert
      expect(response.status).toBe(401);
    });

    it("code が 64 文字未満の場合は 422 を返すこと", async () => {
      // Arrange
      const { db } = createMockDb({ exchangeRow: createMockExchangeRow() });

      // Act
      const response = await callMobileExchange(db, { code: "abc123" });

      // Assert
      expect(response.status).toBe(422);
    });

    it("code が hex 以外の文字を含む場合は 422 を返すこと", async () => {
      // Arrange
      const { db } = createMockDb({ exchangeRow: createMockExchangeRow() });
      const invalidCode = "z".repeat(64);

      // Act
      const response = await callMobileExchange(db, { code: invalidCode });

      // Assert
      expect(response.status).toBe(422);
    });

    it("存在しない code は 401 を返すこと", async () => {
      // Arrange
      const { db } = createMockDb({ exchangeRow: null });

      // Act
      const response = await callMobileExchange(db, { code: VALID_CODE });

      // Assert
      expect(response.status).toBe(401);
    });

    it("code が body にない場合は 422 を返すこと", async () => {
      // Arrange
      const { db } = createMockDb({ exchangeRow: createMockExchangeRow() });

      // Act
      const response = await callMobileExchange(db, {});

      // Assert
      expect(response.status).toBe(422);
    });
  });
});
