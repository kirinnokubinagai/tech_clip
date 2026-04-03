import { describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../apps/api/src/lib/route-helpers";

describe("fetchWithAuth", () => {
  it("セッションが存在する場合にuserを変数にセットしてルートを処理すること", async () => {
    // Arrange
    const mockUser = { id: "user-1", email: "test@example.com" };
    const getSession = vi.fn().mockResolvedValue({ user: mockUser });

    // Act
    const response = await fetchWithAuth(
      getSession,
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

    // Act
    const response = await fetchWithAuth(
      getSession,
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

    // Act
    const responseA = await fetchWithAuth(
      getSession,
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
    const request = new Request("http://localhost/test", {
      headers: { Authorization: "Bearer token123" },
    });

    // Act
    await fetchWithAuth(
      getSession,
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
