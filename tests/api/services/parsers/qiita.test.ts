import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseQiita } from "../../../../apps/api/src/services/parsers/qiita";

/** Qiita API v2 正常レスポンスのモックデータ */
const SAMPLE_QIITA_RESPONSE = {
  id: "abc123def456",
  title: "TypeScriptの型システム完全ガイド",
  body: "## はじめに\n\nTypeScriptの型システムについて解説します。\n\n## 基本型\n\n`string`, `number`, `boolean` が基本です。",
  rendered_body:
    "<h2>はじめに</h2><p>TypeScriptの型システムについて解説します。</p><h2>基本型</h2><p><code>string</code>, <code>number</code>, <code>boolean</code> が基本です。</p>",
  user: {
    id: "qiita_user_123",
    name: "テスト太郎",
  },
  created_at: "2024-06-15T10:00:00+09:00",
  tags: [{ name: "TypeScript" }, { name: "型システム" }],
};

/** bodyがnullのレスポンス */
const RESPONSE_WITHOUT_BODY = {
  ...SAMPLE_QIITA_RESPONSE,
  body: null,
  rendered_body:
    "<h2>HTMLのみ</h2><p>bodyがnullの場合、rendered_bodyからMarkdownに変換します。</p>",
};

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseQiita", () => {
  describe("URL検証", () => {
    it("Qiita以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/article";

      // Act & Assert
      await expect(parseQiita(url)).rejects.toThrow("QiitaのURLではありません");
    });

    it("item_idが含まれないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://qiita.com/user123";

      // Act & Assert
      await expect(parseQiita(url)).rejects.toThrow("QiitaのURLからitem_idを抽出できません");
    });
  });

  describe("正常系", () => {
    it("Qiita記事のタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_QIITA_RESPONSE),
      });
      const url = "https://qiita.com/user123/items/abc123def456";

      // Act
      const result = await parseQiita(url);

      // Assert
      expect(result.title).toBe("TypeScriptの型システム完全ガイド");
    });

    it("bodyフィールドからMarkdownコンテンツを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_QIITA_RESPONSE),
      });
      const url = "https://qiita.com/user123/items/abc123def456";

      // Act
      const result = await parseQiita(url);

      // Assert
      expect(result.content).toContain("はじめに");
      expect(result.content).toContain("TypeScriptの型システムについて");
    });

    it("著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_QIITA_RESPONSE),
      });
      const url = "https://qiita.com/user123/items/abc123def456";

      // Act
      const result = await parseQiita(url);

      // Assert
      expect(result.author).toBe("qiita_user_123");
    });

    it("公開日をISO 8601形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_QIITA_RESPONSE),
      });
      const url = "https://qiita.com/user123/items/abc123def456";

      // Act
      const result = await parseQiita(url);

      // Assert
      expect(result.publishedAt).toBe("2024-06-15T10:00:00+09:00");
    });

    it("sourceが'qiita.com'であること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_QIITA_RESPONSE),
      });
      const url = "https://qiita.com/user123/items/abc123def456";

      // Act
      const result = await parseQiita(url);

      // Assert
      expect(result.source).toBe("qiita.com");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_QIITA_RESPONSE),
      });
      const url = "https://qiita.com/user123/items/abc123def456";

      // Act
      const result = await parseQiita(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("正しいAPIエンドポイントにリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_QIITA_RESPONSE),
      });
      const url = "https://qiita.com/user123/items/abc123def456";

      // Act
      await parseQiita(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://qiita.com/api/v2/items/abc123def456",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.any(String),
          }),
        }),
      );
    });
  });

  describe("bodyがnullの場合", () => {
    it("rendered_bodyからMarkdownに変換できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(RESPONSE_WITHOUT_BODY),
      });
      const url = "https://qiita.com/user123/items/abc123def456";

      // Act
      const result = await parseQiita(url);

      // Assert
      expect(result.content).toContain("HTMLのみ");
    });
  });

  describe("異常系", () => {
    it("APIリクエストが失敗した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      const url = "https://qiita.com/user123/items/abc123def456";

      // Act & Assert
      await expect(parseQiita(url)).rejects.toThrow("Qiita APIからのデータ取得に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://qiita.com/user123/items/abc123def456";

      // Act & Assert
      await expect(parseQiita(url)).rejects.toThrow();
    });
  });

  describe("URL形式バリエーション", () => {
    it("末尾にスラッシュがあるURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_QIITA_RESPONSE),
      });
      const url = "https://qiita.com/user123/items/abc123def456/";

      // Act
      const result = await parseQiita(url);

      // Assert
      expect(result.title).toBe("TypeScriptの型システム完全ガイド");
    });

    it("クエリパラメータ付きURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_QIITA_RESPONSE),
      });
      const url = "https://qiita.com/user123/items/abc123def456?ref=trending";

      // Act
      const result = await parseQiita(url);

      // Assert
      expect(result.title).toBe("TypeScriptの型システム完全ガイド");
    });
  });
});
