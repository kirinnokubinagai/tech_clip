import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractYouTubeVideoId,
  parseYouTube,
} from "../../../../apps/api/src/services/parsers/youtube";

/**
 * テスト用の oEmbed レスポンスを生成する
 */
function buildOEmbedResponse(
  overrides: Partial<Record<string, string>> = {},
): Record<string, string> {
  return {
    title: "テスト動画タイトル",
    author_name: "テストチャンネル",
    author_url: "https://www.youtube.com/@testchannel",
    thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    type: "video",
    provider_name: "YouTube",
    provider_url: "https://www.youtube.com/",
    ...overrides,
  };
}

/**
 * テスト用の動画ページ HTML を生成する
 *
 * 字幕トラックを含む ytInitialPlayerResponse を埋め込む。
 */
function buildVideoPageHtml(captionBaseUrl: string | null): string {
  if (captionBaseUrl === null) {
    const playerResponse = {
      videoDetails: { videoId: "dQw4w9WgXcQ", title: "テスト動画タイトル" },
    };
    return `<html><body><script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script></body></html>`;
  }

  const playerResponse = {
    videoDetails: { videoId: "dQw4w9WgXcQ", title: "テスト動画タイトル" },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: captionBaseUrl,
            languageCode: "ja",
            kind: "",
          },
        ],
      },
    },
  };
  return `<html><body><script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script></body></html>`;
}

/**
 * テスト用の字幕 XML を生成する
 */
function buildCaptionXml(): string {
  return `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
<text start="0" dur="2.5">こんにちは、視聴者の皆さん。</text>
<text start="2.5" dur="3.0">本日は TypeScript について話します。</text>
<text start="5.5" dur="2.0">よろしくお願いします。</text>
</transcript>`;
}

describe("extractYouTubeVideoId", () => {
  it("youtube.com/watch?v= 形式の URL から動画IDを抽出できること", () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    // Act
    const result = extractYouTubeVideoId(url);

    // Assert
    expect(result).toBe("dQw4w9WgXcQ");
  });

  it("youtu.be 形式の短縮 URL から動画IDを抽出できること", () => {
    // Arrange
    const url = "https://youtu.be/dQw4w9WgXcQ";

    // Act
    const result = extractYouTubeVideoId(url);

    // Assert
    expect(result).toBe("dQw4w9WgXcQ");
  });

  it("youtube.com/shorts/ 形式の URL から動画IDを抽出できること", () => {
    // Arrange
    const url = "https://www.youtube.com/shorts/dQw4w9WgXcQ";

    // Act
    const result = extractYouTubeVideoId(url);

    // Assert
    expect(result).toBe("dQw4w9WgXcQ");
  });

  it("m.youtube.com/watch?v= 形式のモバイル URL から動画IDを抽出できること", () => {
    // Arrange
    const url = "https://m.youtube.com/watch?v=dQw4w9WgXcQ";

    // Act
    const result = extractYouTubeVideoId(url);

    // Assert
    expect(result).toBe("dQw4w9WgXcQ");
  });

  it("追加クエリパラメーターが付いている URL から動画IDを抽出できること", () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&feature=share";

    // Act
    const result = extractYouTubeVideoId(url);

    // Assert
    expect(result).toBe("dQw4w9WgXcQ");
  });

  it("YouTube ではない URL の場合エラーになること", () => {
    // Arrange
    const url = "https://example.com/watch?v=dQw4w9WgXcQ";

    // Act & Assert
    expect(() => extractYouTubeVideoId(url)).toThrow("YouTubeのURLではありません");
  });

  it("動画IDを抽出できない場合エラーになること", () => {
    // Arrange
    const url = "https://www.youtube.com/feed/trending";

    // Act & Assert
    expect(() => extractYouTubeVideoId(url)).toThrow("YouTube動画IDを抽出できません");
  });
});

describe("parseYouTube", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("oEmbed と字幕からタイトル・著者・本文を取得できること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const oembed = buildOEmbedResponse();
    const captionUrl = "https://www.youtube.com/api/timedtext?lang=ja&v=dQw4w9WgXcQ";
    const html = buildVideoPageHtml(captionUrl);
    const captionXml = buildCaptionXml();

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string" ? input : input.toString();
      if (requestUrl.includes("/oembed")) {
        return new Response(JSON.stringify(oembed), { status: 200 });
      }
      if (requestUrl.includes("/watch")) {
        return new Response(html, { status: 200 });
      }
      if (requestUrl.includes("/api/timedtext")) {
        return new Response(captionXml, { status: 200 });
      }
      return new Response("Not Found", { status: 404 });
    });

    // Act
    const result = await parseYouTube(url);

    // Assert
    expect(result.title).toBe("テスト動画タイトル");
    expect(result.author).toBe("テストチャンネル");
    expect(result.content).toContain("こんにちは、視聴者の皆さん。");
    expect(result.content).toContain("TypeScript");
    expect(result.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(result.source).toBe("youtube");
    expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it('字幕がない動画の場合 content="" の ParsedArticle を返すこと', async () => {
    // Arrange: oEmbed 取得成功、tracks 空（captions なし）
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementationOnce(async () => {
      return new Response(JSON.stringify({ title: "Test Video", author_name: "Test Author" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    fetchMock.mockImplementationOnce(async () => {
      return new Response(
        '<html><body><script>var ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[]}}};</script></body></html>',
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    });

    // Act
    const result = await parseYouTube("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    // Assert: 字幕なしでも失敗せず content="" で返る
    expect(result.title).toBe("Test Video");
    expect(result.author).toBe("Test Author");
    expect(result.content).toBe("");
    expect(result.readingTimeMinutes).toBe(0);

    fetchMock.mockRestore();
  });
  it("oEmbed API が失敗した場合エラーになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string" ? input : input.toString();
      if (requestUrl.includes("/oembed")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response("Not Found", { status: 404 });
    });

    // Act & Assert
    await expect(parseYouTube(url)).rejects.toThrow("YouTube動画情報の取得に失敗しました");
  });

  it("動画ページが取得できない場合エラーになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const oembed = buildOEmbedResponse();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string" ? input : input.toString();
      if (requestUrl.includes("/oembed")) {
        return new Response(JSON.stringify(oembed), { status: 200 });
      }
      if (requestUrl.includes("/watch")) {
        return new Response("Server Error", { status: 500 });
      }
      return new Response("Not Found", { status: 404 });
    });

    // Act & Assert
    await expect(parseYouTube(url)).rejects.toThrow("YouTube動画ページの取得に失敗しました");
  });

  it("不正なURLの場合エラーになること", async () => {
    // Arrange
    const url = "https://example.com/not-youtube";

    // Act & Assert
    await expect(parseYouTube(url)).rejects.toThrow("YouTubeのURLではありません");
  });

  it("YouTube Shorts の URL も同様に処理できること", async () => {
    // Arrange
    const url = "https://www.youtube.com/shorts/dQw4w9WgXcQ";
    const oembed = buildOEmbedResponse();
    const captionUrl = "https://www.youtube.com/api/timedtext?lang=en&v=dQw4w9WgXcQ";
    const html = buildVideoPageHtml(captionUrl);
    const captionXml = buildCaptionXml();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string" ? input : input.toString();
      if (requestUrl.includes("/oembed")) {
        return new Response(JSON.stringify(oembed), { status: 200 });
      }
      if (requestUrl.includes("/watch")) {
        return new Response(html, { status: 200 });
      }
      if (requestUrl.includes("/api/timedtext")) {
        return new Response(captionXml, { status: 200 });
      }
      return new Response("Not Found", { status: 404 });
    });

    // Act
    const result = await parseYouTube(url);

    // Assert
    expect(result.title).toBe("テスト動画タイトル");
    expect(result.content).toContain("こんにちは");
  });
});
