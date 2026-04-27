import { fetchArticleMetadata } from "@api/services/metadata-fetcher";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeHtmlResponse(html: string, ok = true, status = 200) {
  return {
    ok,
    status,
    text: vi.fn().mockResolvedValue(html),
  };
}

function buildHtml(metas: string, title = "Page Title") {
  return `<!DOCTYPE html><html><head><title>${title}</title>${metas}</head><body></body></html>`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isPrivateHost（SSRF ブロック）", () => {
  const privateUrls = [
    "http://localhost/path",
    "http://127.0.0.1/path",
    "http://127.1.2.3/path",
    "http://10.0.0.1/path",
    "http://10.255.255.255/path",
    "http://192.168.0.1/path",
    "http://192.168.255.255/path",
    "http://172.16.0.1/path",
    "http://172.31.255.255/path",
    "http://169.254.169.254/latest/meta-data",
    "http://metadata.google.internal/computeMetadata/v1",
    "http://metadata.azure.com/metadata/instance",
    "http://[::1]/path",
    "http://[fc00::1]/path",
    "http://[fd12:3456:789a:1::1]/path",
    "http://[fe80::1]/path",
    "ftp://example.com/path",
    "file:///etc/passwd",
    "not-a-url",
  ];

  for (const url of privateUrls) {
    it(`"${url}" はフォールバックを返すこと`, async () => {
      // Arrange & Act
      const result = await fetchArticleMetadata(url);

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.title).toBe(url);
      expect(result.content).toBe("");
      expect(result.readingTimeMinutes).toBe(0);
    });
  }

  it("公開ホストはブロックしないこと", async () => {
    // Arrange
    mockFetch.mockResolvedValue(makeHtmlResponse(buildHtml("")));

    // Act
    await fetchArticleMetadata("https://example.com/article");

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("fetchArticleMetadata", () => {
  describe("正常系: og タグあり", () => {
    it("og:title を title として返すこと", async () => {
      // Arrange
      const html = buildHtml('<meta property="og:title" content="OG タイトル">');
      mockFetch.mockResolvedValue(makeHtmlResponse(html));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.title).toBe("OG タイトル");
    });

    it("og:description を excerpt として返すこと", async () => {
      // Arrange
      const html = buildHtml('<meta property="og:description" content="OG 説明文">');
      mockFetch.mockResolvedValue(makeHtmlResponse(html));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.excerpt).toBe("OG 説明文");
    });

    it("og:image を thumbnailUrl として返すこと", async () => {
      // Arrange
      const html = buildHtml('<meta property="og:image" content="https://example.com/image.jpg">');
      mockFetch.mockResolvedValue(makeHtmlResponse(html));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.thumbnailUrl).toBe("https://example.com/image.jpg");
    });

    it("author メタタグを author として返すこと", async () => {
      // Arrange
      const html = buildHtml('<meta name="author" content="著者名">');
      mockFetch.mockResolvedValue(makeHtmlResponse(html));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.author).toBe("著者名");
    });

    it("article:published_time を publishedAt として返すこと", async () => {
      // Arrange
      const html = buildHtml(
        '<meta property="article:published_time" content="2024-01-15T00:00:00Z">',
      );
      mockFetch.mockResolvedValue(makeHtmlResponse(html));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.publishedAt).toBe("2024-01-15T00:00:00Z");
    });

    it("content は常に空文字列を返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeHtmlResponse(buildHtml("")));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.content).toBe("");
    });

    it("readingTimeMinutes は最小 1 を返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeHtmlResponse(buildHtml("")));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("フォールバック: twitter タグ", () => {
    it("og:title がなく twitter:title がある場合は twitter:title を使うこと", async () => {
      // Arrange
      const html = buildHtml('<meta name="twitter:title" content="Twitter タイトル">');
      mockFetch.mockResolvedValue(makeHtmlResponse(html));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.title).toBe("Twitter タイトル");
    });

    it("og:image がなく twitter:image がある場合は twitter:image を使うこと", async () => {
      // Arrange
      const html = buildHtml('<meta name="twitter:image" content="https://example.com/tw.jpg">');
      mockFetch.mockResolvedValue(makeHtmlResponse(html));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.thumbnailUrl).toBe("https://example.com/tw.jpg");
    });

    it("og:title も twitter:title もない場合は <title> タグを使うこと", async () => {
      // Arrange
      const html = buildHtml("", "ページタイトル");
      mockFetch.mockResolvedValue(makeHtmlResponse(html));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.title).toBe("ページタイトル");
    });

    it("title が全く取れない場合は URL を title として返すこと", async () => {
      // Arrange
      const html = "<!DOCTYPE html><html><head></head><body></body></html>";
      mockFetch.mockResolvedValue(makeHtmlResponse(html));
      const url = "https://example.com/no-title";

      // Act
      const result = await fetchArticleMetadata(url);

      // Assert
      expect(result.title).toBe(url);
    });

    it("twitter:creator を author として使うこと", async () => {
      // Arrange
      const html = buildHtml('<meta name="twitter:creator" content="@creator_handle">');
      mockFetch.mockResolvedValue(makeHtmlResponse(html));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.author).toBe("@creator_handle");
    });
  });

  describe("異常系: fetch 失敗", () => {
    it("fetch がネットワークエラーをスローしたときフォールバックを返すこと", async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error("Network Error"));
      const url = "https://example.com/article";

      // Act
      const result = await fetchArticleMetadata(url);

      // Assert
      expect(result.title).toBe(url);
      expect(result.content).toBe("");
      expect(result.readingTimeMinutes).toBe(0);
    });

    it("fetch がタイムアウトしたときフォールバックを返すこと", async () => {
      // Arrange
      mockFetch.mockRejectedValue(new DOMException("The operation was aborted.", "AbortError"));
      const url = "https://example.com/article";

      // Act
      const result = await fetchArticleMetadata(url);

      // Assert
      expect(result.title).toBe(url);
    });

    it("HTTP 404 のときフォールバックを返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeHtmlResponse("", false, 404));
      const url = "https://example.com/not-found";

      // Act
      const result = await fetchArticleMetadata(url);

      // Assert
      expect(result.title).toBe(url);
    });

    it("HTTP 500 のときフォールバックを返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeHtmlResponse("", false, 500));
      const url = "https://example.com/server-error";

      // Act
      const result = await fetchArticleMetadata(url);

      // Assert
      expect(result.title).toBe(url);
    });

    it("空の HTML のときフォールバックを返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeHtmlResponse(""));
      const url = "https://example.com/empty";

      // Act
      const result = await fetchArticleMetadata(url);

      // Assert
      expect(result.title).toBe(url);
    });
  });

  describe("source 検出", () => {
    it("zenn.dev URL の source が 'zenn' であること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeHtmlResponse(buildHtml("")));

      // Act
      const result = await fetchArticleMetadata("https://zenn.dev/user/articles/example");

      // Assert
      expect(result.source).toBe("zenn");
    });

    it("qiita.com URL の source が 'qiita' であること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeHtmlResponse(buildHtml("")));

      // Act
      const result = await fetchArticleMetadata("https://qiita.com/user/items/abc123");

      // Assert
      expect(result.source).toBe("qiita");
    });

    it("不明な URL の source が 'other' であること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeHtmlResponse(buildHtml("")));

      // Act
      const result = await fetchArticleMetadata("https://example.com/article");

      // Assert
      expect(result.source).toBe("other");
    });

    it("SSRF ブロック時も source を正しく返すこと", async () => {
      // Arrange & Act
      const result = await fetchArticleMetadata("http://localhost/path");

      // Assert
      expect(result.source).toBe("other");
    });
  });

  describe("fetch リクエスト検証", () => {
    it("User-Agent ヘッダーを含めてリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeHtmlResponse(buildHtml("")));

      // Act
      await fetchArticleMetadata("https://example.com/article");

      // Assert
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/TechClipBot/);
    });

    it("AbortSignal を含めてリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(makeHtmlResponse(buildHtml("")));

      // Act
      await fetchArticleMetadata("https://example.com/article");

      // Assert
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeDefined();
    });
  });
});
