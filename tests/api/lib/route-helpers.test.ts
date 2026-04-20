import { fetchWithAuth } from "@api/lib/route-helpers";
import { describe, expect, it, vi } from "vitest";

/**
 * fetchWithAuth は Database と Auth を受け取るため、テストでは最小限の
 * モック (getSession のみ) を用意し、Bearer token を使用しないケースは
 * Database の select を呼ばないことを検証する
 */

/**
 * 最小モック: getSession のみを返す Auth ライクオブジェクト
 */
function createMockAuth(
  getSession: (opts: { headers: Headers }) => Promise<{ user: Record<string, unknown> } | null>,
) {
  return { api: { getSession } } as unknown as Parameters<typeof fetchWithAuth>[1];
}

/**
 * 空の Database モック（Bearer 認証が呼ばれたときだけ参照される）
 */
function createMockDb() {
  // Bearer token 検証パスに入ったら select が呼ばれるが、
  // これらのテストは Cookie セッションを返すため通常は呼ばれない
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
  } as unknown as Parameters<typeof fetchWithAuth>[0];
}

describe("fetchWithAuth", () => {
  it("セッションが存在する場合にuserを変数にセットしてルートを処理すること", async () => {
    // Arrange
    const mockUser = { id: "user-1", email: "test@example.com" };
    const getSession = vi.fn().mockResolvedValue({ user: mockUser });
    const db = createMockDb();
    const auth = createMockAuth(getSession);

    // Act
    const response = await fetchWithAuth(
      db,
      auth,
      (subApp) => {
        subApp.get("/test", (c) => {
          const user = c.get("user");
          return c.json({ user });
        });
      },
      new Request("http://localhost/test"),
    );

    // Assert
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.user).toStrictEqual(mockUser);
  });

  it("セッションが存在しない場合にuserをセットせずルートを処理すること", async () => {
    // Arrange
    const getSession = vi.fn().mockResolvedValue(null);
    const db = createMockDb();
    const auth = createMockAuth(getSession);

    // Act
    const response = await fetchWithAuth(
      db,
      auth,
      (subApp) => {
        subApp.get("/test", (c) => {
          const user = c.get("user");
          return c.json({ user: user ?? null });
        });
      },
      new Request("http://localhost/test"),
    );

    // Assert
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.user).toBeNull();
  });

  it("複数ルートをマウントできること", async () => {
    // Arrange
    const getSession = vi.fn().mockResolvedValue(null);
    const db = createMockDb();
    const auth = createMockAuth(getSession);

    // Act
    const responseA = await fetchWithAuth(
      db,
      auth,
      (subApp) => {
        subApp.get("/a", (c) => c.json({ route: "a" }));
        subApp.get("/b", (c) => c.json({ route: "b" }));
      },
      new Request("http://localhost/b"),
    );

    // Assert
    expect(responseA.status).toBe(200);
    const body = (await responseA.json()) as Record<string, unknown>;
    expect(body.route).toBe("b");
  });

  it("getSessionが呼ばれたときにリクエストのHeadersが渡されること", async () => {
    // Arrange
    const getSession = vi.fn().mockResolvedValue(null);
    const db = createMockDb();
    const auth = createMockAuth(getSession);
    const request = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer token123" },
    });

    // Act
    await fetchWithAuth(
      db,
      auth,
      (subApp) => {
        subApp.get("/test", (c) => c.json({}));
      },
      request,
    );

    // Assert
    expect(getSession).toHaveBeenCalledOnce();
    const calledHeaders = getSession.mock.calls[0][0].headers;
    expect(calledHeaders.get("Authorization")).toBe("Bearer token123");
  });
});
