import { parseLogrocket } from "@api/services/parsers/logrocket";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** LogRocket記事のHTMLテンプレート */
const SAMPLE_LOGROCKET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>A complete guide to React Hooks</title>
  <meta property="og:title" content="A complete guide to React Hooks" />
  <meta property="og:image" content="https://blog.logrocket.com/wp-content/uploads/2024/02/react-hooks-guide.png" />
  <meta property="article:author" content="https://blog.logrocket.com/author/testauthor/" />
  <meta property="article:published_time" content="2024-06-15T14:00:00.000Z" />
  <meta name="author" content="LogRocketテスト著者" />
</head>
<body>
  <article>
    <h1>A complete guide to React Hooks</h1>
    <p>React Hooks revolutionized the way we write React components.</p>
    <p>In this comprehensive guide, we will explore all the built-in hooks.</p>
    <h2>useState</h2>
    <p>The useState hook allows you to add state to functional components.</p>
    <p>It returns an array with two elements: the current state and a function to update it.</p>
    <p>This is the most commonly used hook in React applications.</p>
  </article>
</body>
</html>
`;

/** OGPメタタグなしのHTML */
const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>最小限のLogRocket記事</title>
</head>
<body>
  <article>
    <h1>最小限のLogRocket記事</h1>
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

describe("parseLogrocket", () => {
  describe("URL検証", () => {
    it("LogRocket以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/article";

      // Act & Assert
      await expect(parseLogrocket(url)).rejects.toThrow("LogRocketのURLではありません");
    });

    it("blog.logrocket.comドメインを受け付けること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_LOGROCKET_HTML),
      });
      const url = "https://blog.logrocket.com/complete-guide-react-hooks/";

      // Act
      const result = await parseLogrocket(url);

      // Assert
      expect(result.source).toBe("blog.logrocket.com");
    });
  });

  describe("正常系", () => {
    it("記事のタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_LOGROCKET_HTML),
      });
      const url = "https://blog.logrocket.com/complete-guide-react-hooks/";

      // Act
      const result = await parseLogrocket(url);

      // Assert
      expect(result.title).toBe("A complete guide to React Hooks");
    });

    it("記事本文をMarkdown形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_LOGROCKET_HTML),
      });
      const url = "https://blog.logrocket.com/complete-guide-react-hooks/";

      // Act
      const result = await parseLogrocket(url);

      // Assert
      expect(result.content).toContain("React Hooks");
    });

    it("OGPメタタグからサムネイルURLを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_LOGROCKET_HTML),
      });
      const url = "https://blog.logrocket.com/complete-guide-react-hooks/";

      // Act
      const result = await parseLogrocket(url);

      // Assert
      expect(result.thumbnailUrl).toBe(
        "https://blog.logrocket.com/wp-content/uploads/2024/02/react-hooks-guide.png",
      );
    });

    it("metaタグから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_LOGROCKET_HTML),
      });
      const url = "https://blog.logrocket.com/complete-guide-react-hooks/";

      // Act
      const result = await parseLogrocket(url);

      // Assert
      expect(result.author).toBe("LogRocketテスト著者");
    });

    it("公開日をISO 8601形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_LOGROCKET_HTML),
      });
      const url = "https://blog.logrocket.com/complete-guide-react-hooks/";

      // Act
      const result = await parseLogrocket(url);

      // Assert
      expect(result.publishedAt).toBe("2024-06-15T14:00:00.000Z");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_LOGROCKET_HTML),
      });
      const url = "https://blog.logrocket.com/complete-guide-react-hooks/";

      // Act
      const result = await parseLogrocket(url);

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
      const url = "https://blog.logrocket.com/minimal-article/";

      // Act
      const result = await parseLogrocket(url);

      // Assert
      expect(result.title).toBe("最小限のLogRocket記事");
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
      const url = "https://blog.logrocket.com/not-found/";

      // Act & Assert
      await expect(parseLogrocket(url)).rejects.toThrow("LogRocket記事の取得に失敗しました");
    });

    it("本文が抽出できない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_CONTENT_HTML),
      });
      const url = "https://blog.logrocket.com/empty/";

      // Act & Assert
      await expect(parseLogrocket(url)).rejects.toThrow("LogRocket記事の本文の抽出に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://blog.logrocket.com/error/";

      // Act & Assert
      await expect(parseLogrocket(url)).rejects.toThrow();
    });
  });

  describe("fetchリクエスト", () => {
    it("User-Agentヘッダーを送信すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_LOGROCKET_HTML),
      });
      const url = "https://blog.logrocket.com/complete-guide-react-hooks/";

      // Act
      await parseLogrocket(url);

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
