import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseSmashing } from "../../../../apps/api/src/services/parsers/smashing";

/** Smashing Magazine記事のHTMLテンプレート */
const SAMPLE_SMASHING_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Modern CSS Solutions for Old CSS Problems</title>
  <meta property="og:title" content="Modern CSS Solutions for Old CSS Problems" />
  <meta property="og:image" content="https://www.smashingmagazine.com/images/2024/04/modern-css-solutions.png" />
  <meta property="article:author" content="https://www.smashingmagazine.com/author/testauthor/" />
  <meta property="article:published_time" content="2024-04-25T10:00:00.000Z" />
  <meta name="author" content="Smashingテスト著者" />
</head>
<body>
  <article>
    <h1>Modern CSS Solutions for Old CSS Problems</h1>
    <p>CSS has evolved dramatically over the past few years.</p>
    <p>Many common problems that required JavaScript or complex workarounds can now be solved with pure CSS.</p>
    <h2>Container Queries</h2>
    <p>Container queries allow you to style elements based on their container size.</p>
    <p>This is a game-changer for component-based design systems.</p>
    <p>Let's explore how to use them effectively in your projects.</p>
  </article>
</body>
</html>
`;

/** OGPメタタグなしのHTML */
const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>最小限のSmashing Magazine記事</title>
</head>
<body>
  <article>
    <h1>最小限のSmashing Magazine記事</h1>
    <p>メタ情報のない記事です。本文のみ含まれています。</p>
    <p>Readabilityが認識できるように複数の段落を用意します。</p>
    <p>段落を追加してコンテンツ量を確保します。</p>
    <p>さらに追加の段落でボリュームを増やします。</p>
    <p>最後の段落です。パーサーのテストに使用します。</p>
  </article>
</body>
</html>
`;

/** 本文が空のHTML */
const EMPTY_CONTENT_HTML = `
<!DOCTYPE html>
<html>
<head><title>空の記事</title></head>
<body></body>
</html>
`;

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseSmashing", () => {
  describe("URL検証", () => {
    it("Smashing Magazine以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/article";

      // Act & Assert
      await expect(parseSmashing(url)).rejects.toThrow("Smashing MagazineのURLではありません");
    });

    it("www.smashingmagazine.comドメインを受け付けること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SMASHING_HTML),
      });
      const url = "https://www.smashingmagazine.com/2024/04/modern-css-solutions/";

      // Act
      const result = await parseSmashing(url);

      // Assert
      expect(result.source).toBe("www.smashingmagazine.com");
    });

    it("smashingmagazine.comドメインを受け付けること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SMASHING_HTML),
      });
      const url = "https://smashingmagazine.com/2024/04/modern-css-solutions/";

      // Act
      const result = await parseSmashing(url);

      // Assert
      expect(result.source).toBe("smashingmagazine.com");
    });
  });

  describe("正常系", () => {
    it("記事のタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SMASHING_HTML),
      });
      const url = "https://www.smashingmagazine.com/2024/04/modern-css-solutions/";

      // Act
      const result = await parseSmashing(url);

      // Assert
      expect(result.title).toBe("Modern CSS Solutions for Old CSS Problems");
    });

    it("記事本文をMarkdown形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SMASHING_HTML),
      });
      const url = "https://www.smashingmagazine.com/2024/04/modern-css-solutions/";

      // Act
      const result = await parseSmashing(url);

      // Assert
      expect(result.content).toContain("Container Queries");
    });

    it("OGPメタタグからサムネイルURLを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SMASHING_HTML),
      });
      const url = "https://www.smashingmagazine.com/2024/04/modern-css-solutions/";

      // Act
      const result = await parseSmashing(url);

      // Assert
      expect(result.thumbnailUrl).toBe(
        "https://www.smashingmagazine.com/images/2024/04/modern-css-solutions.png",
      );
    });

    it("metaタグから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SMASHING_HTML),
      });
      const url = "https://www.smashingmagazine.com/2024/04/modern-css-solutions/";

      // Act
      const result = await parseSmashing(url);

      // Assert
      expect(result.author).toBe("Smashingテスト著者");
    });

    it("公開日をISO 8601形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SMASHING_HTML),
      });
      const url = "https://www.smashingmagazine.com/2024/04/modern-css-solutions/";

      // Act
      const result = await parseSmashing(url);

      // Assert
      expect(result.publishedAt).toBe("2024-04-25T10:00:00.000Z");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SMASHING_HTML),
      });
      const url = "https://www.smashingmagazine.com/2024/04/modern-css-solutions/";

      // Act
      const result = await parseSmashing(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("OGPメタタグなし", () => {
    it("メタタグがない場合でも記事を抽出できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_HTML),
      });
      const url = "https://www.smashingmagazine.com/2024/04/minimal-article/";

      // Act
      const result = await parseSmashing(url);

      // Assert
      expect(result.title).toBe("最小限のSmashing Magazine記事");
      expect(result.content).toContain("メタ情報のない記事");
      expect(result.thumbnailUrl).toBeNull();
      expect(result.author).toBeNull();
      expect(result.publishedAt).toBeNull();
    });
  });

  describe("異常系", () => {
    it("fetchが失敗した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      const url = "https://www.smashingmagazine.com/2024/04/not-found/";

      // Act & Assert
      await expect(parseSmashing(url)).rejects.toThrow("Smashing Magazine記事の取得に失敗しました");
    });

    it("本文が抽出できない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_CONTENT_HTML),
      });
      const url = "https://www.smashingmagazine.com/2024/04/empty/";

      // Act & Assert
      await expect(parseSmashing(url)).rejects.toThrow(
        "Smashing Magazine記事の本文の抽出に失敗しました",
      );
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://www.smashingmagazine.com/2024/04/error/";

      // Act & Assert
      await expect(parseSmashing(url)).rejects.toThrow();
    });
  });

  describe("fetchリクエスト", () => {
    it("User-Agentヘッダーを送信すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SMASHING_HTML),
      });
      const url = "https://www.smashingmagazine.com/2024/04/modern-css-solutions/";

      // Act
      await parseSmashing(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("TechClipBot"),
          }),
        }),
      );
    });
  });
});
