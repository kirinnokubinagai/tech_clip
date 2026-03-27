import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseSpeakerdeck } from "./speakerdeck";

/** SpeakerdeckページのHTMLモック（OGPメタタグあり） */
const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Rubyの型チェック事情 by testuser - Speaker Deck</title>
  <meta property="og:title" content="Rubyの型チェック事情" />
  <meta property="og:description" content="RubyKaigi 2024で発表したスライドです。RBSとSteepを使った型チェックの実践について解説します。" />
  <meta property="og:image" content="https://files.speakerdeck.com/presentations/abc123/slide_0.jpg" />
  <meta name="author" content="testuser" />
  <meta property="article:published_time" content="2024-05-15T00:00:00Z" />
</head>
<body>
  <div class="deck-header">
    <h1>Rubyの型チェック事情</h1>
    <div class="deck-description">
      <p>RubyKaigi 2024で発表したスライドです。RBSとSteepを使った型チェックの実践について解説します。</p>
    </div>
  </div>
  <div class="speakerdeck-embed" data-id="abc123"></div>
</body>
</html>
`;

/** OGPメタタグ最小限のHTML */
const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>最小限のスライド - Speaker Deck</title>
  <meta property="og:title" content="最小限のスライド" />
</head>
<body>
  <div class="deck-header">
    <h1>最小限のスライド</h1>
  </div>
</body>
</html>
`;

/** タイトルがないHTML */
const NO_TITLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title></title>
</head>
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

describe("parseSpeakerdeck", () => {
  describe("正常系", () => {
    it("OGPメタタグからタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });
      const url = "https://speakerdeck.com/testuser/ruby-type-checking";

      // Act
      const result = await parseSpeakerdeck(url);

      // Assert
      expect(result.title).toBe("Rubyの型チェック事情");
    });

    it("OGPメタタグから概要を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });
      const url = "https://speakerdeck.com/testuser/ruby-type-checking";

      // Act
      const result = await parseSpeakerdeck(url);

      // Assert
      expect(result.excerpt).toContain("RubyKaigi 2024");
    });

    it("OGPメタタグからサムネイルURLを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });
      const url = "https://speakerdeck.com/testuser/ruby-type-checking";

      // Act
      const result = await parseSpeakerdeck(url);

      // Assert
      expect(result.thumbnailUrl).toBe(
        "https://files.speakerdeck.com/presentations/abc123/slide_0.jpg",
      );
    });

    it("authorメタタグから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });
      const url = "https://speakerdeck.com/testuser/ruby-type-checking";

      // Act
      const result = await parseSpeakerdeck(url);

      // Assert
      expect(result.author).toBe("testuser");
    });

    it("公開日を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });
      const url = "https://speakerdeck.com/testuser/ruby-type-checking";

      // Act
      const result = await parseSpeakerdeck(url);

      // Assert
      expect(result.publishedAt).toBe("2024-05-15T00:00:00Z");
    });

    it("sourceにspeakerdeck.comが設定されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });
      const url = "https://speakerdeck.com/testuser/ruby-type-checking";

      // Act
      const result = await parseSpeakerdeck(url);

      // Assert
      expect(result.source).toBe("speakerdeck.com");
    });

    it("contentにOGP概要が含まれること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });
      const url = "https://speakerdeck.com/testuser/ruby-type-checking";

      // Act
      const result = await parseSpeakerdeck(url);

      // Assert
      expect(result.content).toContain("RubyKaigi 2024");
    });

    it("読了時間が1分以上になること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });
      const url = "https://speakerdeck.com/testuser/ruby-type-checking";

      // Act
      const result = await parseSpeakerdeck(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("OGPメタタグなし", () => {
    it("メタタグが最小限でも記事情報を返せること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_HTML),
      });
      const url = "https://speakerdeck.com/testuser/minimal-slide";

      // Act
      const result = await parseSpeakerdeck(url);

      // Assert
      expect(result.title).toBe("最小限のスライド");
      expect(result.thumbnailUrl).toBeNull();
      expect(result.author).toBeNull();
      expect(result.publishedAt).toBeNull();
      expect(result.excerpt).toBeNull();
    });
  });

  describe("URL検証", () => {
    it("Speakerdeck以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/slides/test";

      // Act & Assert
      await expect(parseSpeakerdeck(url)).rejects.toThrow("Speakerdeck");
    });

    it("正しいURLでfetchが呼ばれること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });
      const url = "https://speakerdeck.com/testuser/ruby-type-checking";

      // Act
      await parseSpeakerdeck(url);

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

  describe("異常系", () => {
    it("fetchが失敗した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      const url = "https://speakerdeck.com/testuser/not-found";

      // Act & Assert
      await expect(parseSpeakerdeck(url)).rejects.toThrow("取得に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://speakerdeck.com/testuser/some-slide";

      // Act & Assert
      await expect(parseSpeakerdeck(url)).rejects.toThrow();
    });

    it("タイトルが取得できない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(NO_TITLE_HTML),
      });
      const url = "https://speakerdeck.com/testuser/empty-slide";

      // Act & Assert
      await expect(parseSpeakerdeck(url)).rejects.toThrow("タイトル");
    });
  });
});
