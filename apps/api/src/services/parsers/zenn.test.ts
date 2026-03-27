import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseZenn } from "./zenn";

/** Zenn APIレスポンスのモックデータ */
const SAMPLE_API_RESPONSE = {
  article: {
    title: "TypeScriptの型パズル入門",
    slug: "typescript-type-puzzles",
    published_at: "2024-07-20T09:00:00.000+09:00",
    body_html:
      "<h2>はじめに</h2><p>TypeScriptの型システムは非常に強力です。</p><p>この記事では型パズルの基礎を解説します。</p><h2>基本的な型</h2><p>まずはユニオン型から始めましょう。</p><pre><code>type Result = Success | Failure;</code></pre>",
    emoji: "🧩",
    article_type: "tech",
    user: {
      username: "testuser",
      name: "テストユーザー",
    },
    og_image_url: "https://res.cloudinary.com/zenn/image/upload/articles/abc123.png",
  },
};

/** body_htmlが空のレスポンス */
const EMPTY_BODY_RESPONSE = {
  article: {
    title: "空の記事",
    slug: "empty-article",
    published_at: "2024-01-01T00:00:00.000+09:00",
    body_html: "",
    emoji: "📝",
    article_type: "tech",
    user: {
      username: "emptyuser",
      name: "空ユーザー",
    },
    og_image_url: null,
  },
};

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseZenn", () => {
  describe("正常系", () => {
    it("Zenn APIから記事情報を取得してParsedArticleに変換できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_API_RESPONSE),
      });
      const url = "https://zenn.dev/testuser/articles/typescript-type-puzzles";

      // Act
      const result = await parseZenn(url);

      // Assert
      expect(result.title).toBe("TypeScriptの型パズル入門");
      expect(result.author).toBe("testuser");
      expect(result.source).toBe("zenn.dev");
      expect(result.publishedAt).toBe("2024-07-20T09:00:00.000+09:00");
    });

    it("body_htmlをMarkdownに変換できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_API_RESPONSE),
      });
      const url = "https://zenn.dev/testuser/articles/typescript-type-puzzles";

      // Act
      const result = await parseZenn(url);

      // Assert
      expect(result.content).toContain("はじめに");
      expect(result.content).toContain("TypeScriptの型システムは非常に強力です");
    });

    it("OG画像URLがthumbnailUrlに設定されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_API_RESPONSE),
      });
      const url = "https://zenn.dev/testuser/articles/typescript-type-puzzles";

      // Act
      const result = await parseZenn(url);

      // Assert
      expect(result.thumbnailUrl).toBe(
        "https://res.cloudinary.com/zenn/image/upload/articles/abc123.png",
      );
    });

    it("読了時間が計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_API_RESPONSE),
      });
      const url = "https://zenn.dev/testuser/articles/typescript-type-puzzles";

      // Act
      const result = await parseZenn(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("Zenn APIに正しいslugでリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_API_RESPONSE),
      });
      const url = "https://zenn.dev/testuser/articles/typescript-type-puzzles";

      // Act
      await parseZenn(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://zenn.dev/api/articles/typescript-type-puzzles",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("TechClipBot"),
          }),
        }),
      );
    });
  });

  describe("URL解析", () => {
    it("末尾スラッシュ付きURLからslugを抽出できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_API_RESPONSE),
      });
      const url = "https://zenn.dev/testuser/articles/typescript-type-puzzles/";

      // Act
      await parseZenn(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://zenn.dev/api/articles/typescript-type-puzzles",
        expect.anything(),
      );
    });

    it("Zenn以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/articles/some-article";

      // Act & Assert
      await expect(parseZenn(url)).rejects.toThrow("Zenn");
    });

    it("articles パスを含まないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://zenn.dev/testuser/books/some-book";

      // Act & Assert
      await expect(parseZenn(url)).rejects.toThrow("slug");
    });
  });

  describe("異常系", () => {
    it("APIが404を返した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      const url = "https://zenn.dev/testuser/articles/not-found-article";

      // Act & Assert
      await expect(parseZenn(url)).rejects.toThrow("取得に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://zenn.dev/testuser/articles/some-article";

      // Act & Assert
      await expect(parseZenn(url)).rejects.toThrow();
    });

    it("body_htmlが空の場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(EMPTY_BODY_RESPONSE),
      });
      const url = "https://zenn.dev/emptyuser/articles/empty-article";

      // Act & Assert
      await expect(parseZenn(url)).rejects.toThrow("本文");
    });
  });

  describe("OG画像なし", () => {
    it("og_image_urlがnullの場合thumbnailUrlがnullになること", async () => {
      // Arrange
      const responseWithoutImage = {
        article: {
          ...SAMPLE_API_RESPONSE.article,
          og_image_url: null,
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithoutImage),
      });
      const url = "https://zenn.dev/testuser/articles/typescript-type-puzzles";

      // Act
      const result = await parseZenn(url);

      // Assert
      expect(result.thumbnailUrl).toBeNull();
    });
  });
});
