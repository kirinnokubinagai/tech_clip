import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseDevto } from "./devto";

/** Dev.to API 正常レスポンスのモックデータ */
const SAMPLE_DEVTO_RESPONSE = {
  id: 123456,
  title: "Getting Started with TypeScript in 2024",
  description: "A comprehensive guide to TypeScript for beginners.",
  body_markdown:
    "## Introduction\n\nTypeScript is a typed superset of JavaScript.\n\n## Setup\n\nInstall TypeScript with `npm install typescript`.",
  body_html:
    "<h2>Introduction</h2><p>TypeScript is a typed superset of JavaScript.</p><h2>Setup</h2><p>Install TypeScript with <code>npm install typescript</code>.</p>",
  user: {
    username: "devuser42",
    name: "Dev User",
  },
  published_at: "2024-08-10T12:00:00Z",
  cover_image: "https://dev.to/cover/typescript-guide.png",
  tag_list: ["typescript", "javascript", "beginners"],
  url: "https://dev.to/devuser42/getting-started-with-typescript-in-2024-abc1",
};

/** body_markdownがnullのレスポンス */
const RESPONSE_WITHOUT_BODY_MARKDOWN = {
  ...SAMPLE_DEVTO_RESPONSE,
  body_markdown: null,
  body_html:
    "<h2>HTML Only</h2><p>body_markdownがnullの場合、body_htmlからMarkdownに変換します。</p>",
};

/** cover_imageがnullのレスポンス */
const RESPONSE_WITHOUT_COVER_IMAGE = {
  ...SAMPLE_DEVTO_RESPONSE,
  cover_image: null,
};

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseDevto", () => {
  describe("URL検証", () => {
    it("Dev.to以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/article";

      // Act & Assert
      await expect(parseDevto(url)).rejects.toThrow("Dev.toのURLではありません");
    });

    it("ユーザー名とslugが含まれないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://dev.to/";

      // Act & Assert
      await expect(parseDevto(url)).rejects.toThrow(
        "Dev.toのURLからusernameとslugを抽出できません",
      );
    });

    it("slugが含まれないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://dev.to/devuser42";

      // Act & Assert
      await expect(parseDevto(url)).rejects.toThrow(
        "Dev.toのURLからusernameとslugを抽出できません",
      );
    });
  });

  describe("正常系", () => {
    it("Dev.to記事のタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.title).toBe("Getting Started with TypeScript in 2024");
    });

    it("body_markdownからMarkdownコンテンツを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.content).toContain("Introduction");
      expect(result.content).toContain("TypeScript is a typed superset");
    });

    it("著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.author).toBe("devuser42");
    });

    it("公開日をISO 8601形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.publishedAt).toBe("2024-08-10T12:00:00Z");
    });

    it("sourceが'dev.to'であること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.source).toBe("dev.to");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("サムネイルURLを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.thumbnailUrl).toBe("https://dev.to/cover/typescript-guide.png");
    });

    it("正しいAPIエンドポイントにリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act
      await parseDevto(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://dev.to/api/articles/devuser42/getting-started-with-typescript-abc1",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.any(String),
          }),
        }),
      );
    });
  });

  describe("body_markdownがnullの場合", () => {
    it("body_htmlからMarkdownに変換できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(RESPONSE_WITHOUT_BODY_MARKDOWN),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.content).toContain("HTML Only");
    });
  });

  describe("cover_imageがnullの場合", () => {
    it("thumbnailUrlがnullであること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(RESPONSE_WITHOUT_COVER_IMAGE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.thumbnailUrl).toBeNull();
    });
  });

  describe("異常系", () => {
    it("APIリクエストが失敗した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act & Assert
      await expect(parseDevto(url)).rejects.toThrow("Dev.to APIからのデータ取得に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1";

      // Act & Assert
      await expect(parseDevto(url)).rejects.toThrow();
    });
  });

  describe("URL形式バリエーション", () => {
    it("末尾にスラッシュがあるURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1/";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.title).toBe("Getting Started with TypeScript in 2024");
    });

    it("クエリパラメータ付きURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/devuser42/getting-started-with-typescript-abc1?ref=trending";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.title).toBe("Getting Started with TypeScript in 2024");
    });

    it("組織名付きURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_DEVTO_RESPONSE),
      });
      const url = "https://dev.to/organization/getting-started-with-typescript-abc1";

      // Act
      const result = await parseDevto(url);

      // Assert
      expect(result.title).toBe("Getting Started with TypeScript in 2024");
    });
  });
});
