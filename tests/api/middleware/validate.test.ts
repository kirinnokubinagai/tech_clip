import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateJson, validateQuery } from "../../../apps/api/src/middleware/validate";

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** バリデーション成功レスポンスの型 */
type SuccessBody = {
  success: boolean;
  data: unknown;
};

/** バリデーションエラーレスポンスの型 */
type ErrorBody = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details: Array<{ field: string; message: string }>;
  };
};

/** テスト用スキーマ */
const testSchema = z.object({
  name: z.string().min(1, "名前を入力してください"),
  age: z.number().int("年齢は整数で入力してください").min(0, "年齢は0以上にしてください"),
});

/**
 * validateJson テスト用のHonoアプリを作成する
 */
function createJsonTestApp() {
  const app = new Hono<{ Variables: { validatedBody: unknown } }>();
  app.post("/test", validateJson(testSchema), (c) => {
    const body = c.get("validatedBody");
    return c.json({ success: true, data: body });
  });
  return app;
}

/**
 * validateQuery テスト用のHonoアプリを作成する
 */
function createQueryTestApp() {
  const querySchema = z.object({
    q: z.string().min(1, "検索キーワードを入力してください"),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  });
  const app = new Hono<{ Variables: { validatedQuery: unknown } }>();
  app.get("/test", validateQuery(querySchema), (c) => {
    const query = c.get("validatedQuery");
    return c.json({ success: true, data: query });
  });
  return app;
}

describe("validateJson", () => {
  describe("バリデーション成功", () => {
    it("有効なJSONボディを受け付けて次のハンドラーに渡すこと", async () => {
      // Arrange
      const app = createJsonTestApp();
      const body = { name: "テストユーザー", age: 25 };

      // Act
      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const json = (await res.json()) as SuccessBody;
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({ name: "テストユーザー", age: 25 });
    });

    it("バリデーション後にvalidatedBodyがコンテキストにセットされること", async () => {
      // Arrange
      const app = createJsonTestApp();
      const body = { name: "田中太郎", age: 30 };

      // Act
      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const json = (await res.json()) as SuccessBody;
      expect(json.data).toMatchObject(body);
    });
  });

  describe("バリデーション失敗", () => {
    it("必須フィールドが欠けている場合422を返すこと", async () => {
      // Arrange
      const app = createJsonTestApp();

      // Act
      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age: 25 }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const json = (await res.json()) as ErrorBody;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_FAILED");
    });

    it("型が不正な場合422を返すこと", async () => {
      // Arrange
      const app = createJsonTestApp();

      // Act
      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "テスト", age: "二十五" }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const json = (await res.json()) as ErrorBody;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_FAILED");
    });

    it("エラーレスポンスにdetailsフィールドが含まれること", async () => {
      // Arrange
      const app = createJsonTestApp();

      // Act
      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", age: -1 }),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const json = (await res.json()) as ErrorBody;
      expect(json.error.details).toBeInstanceOf(Array);
      expect(json.error.details.length).toBeGreaterThan(0);
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createJsonTestApp();

      // Act
      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Assert
      const json = (await res.json()) as ErrorBody;
      expect(json.error.message).toBe("入力内容を確認してください");
    });

    it("不正なJSONボディの場合422を返すこと", async () => {
      // Arrange
      const app = createJsonTestApp();

      // Act
      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json{{{",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const json = (await res.json()) as ErrorBody;
      expect(json.success).toBe(false);
    });

    it("エラーdetailsにfieldとmessageが含まれること", async () => {
      // Arrange
      const app = createJsonTestApp();

      // Act
      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", age: 25 }),
      });

      // Assert
      const json = (await res.json()) as ErrorBody;
      const detail = json.error.details[0];
      expect(detail).toHaveProperty("field");
      expect(detail).toHaveProperty("message");
      expect(detail.message).toBe("名前を入力してください");
    });
  });
});

describe("validateQuery", () => {
  describe("バリデーション成功", () => {
    it("有効なクエリパラメータを受け付けて次のハンドラーに渡すこと", async () => {
      // Arrange
      const app = createQueryTestApp();

      // Act
      const res = await app.request("/test?q=typescript&limit=10");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const json = (await res.json()) as SuccessBody;
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({ q: "typescript" });
    });

    it("バリデーション後にvalidatedQueryがコンテキストにセットされること", async () => {
      // Arrange
      const app = createQueryTestApp();

      // Act
      const res = await app.request("/test?q=vitest");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const json = (await res.json()) as SuccessBody;
      expect((json.data as Record<string, unknown>).q).toBe("vitest");
    });
  });

  describe("バリデーション失敗", () => {
    it("必須クエリパラメータが欠けている場合422を返すこと", async () => {
      // Arrange
      const app = createQueryTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const json = (await res.json()) as ErrorBody;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_FAILED");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createQueryTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      const json = (await res.json()) as ErrorBody;
      expect(json.error.message).toBe("入力内容を確認してください");
    });

    it("エラーレスポンスにdetailsフィールドが含まれること", async () => {
      // Arrange
      const app = createQueryTestApp();

      // Act
      const res = await app.request("/test");

      // Assert
      const json = (await res.json()) as ErrorBody;
      expect(json.error.details).toBeInstanceOf(Array);
      expect(json.error.details.length).toBeGreaterThan(0);
    });

    it("エラーdetailsにfieldとmessageが含まれること", async () => {
      // Arrange
      const app = createQueryTestApp();

      // Act
      const res = await app.request("/test?q=");

      // Assert
      const json = (await res.json()) as ErrorBody;
      const detail = json.error.details[0];
      expect(detail).toHaveProperty("field");
      expect(detail).toHaveProperty("message");
    });
  });
});
