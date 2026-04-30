import { parseGeneric } from "@api/services/parsers/generic";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用HTMLテンプレート */
const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>テスト記事タイトル</title>
  <meta property="og:image" content="https://example.com/thumb.jpg" />
  <meta property="article:author" content="テスト著者" />
  <meta property="article:published_time" content="2024-06-15T10:00:00Z" />
</head>
<body>
  <article>
    <h1>テスト記事タイトル</h1>
    <p>これはテスト記事の本文です。十分な長さのコンテンツが必要です。</p>
    <p>Readabilityが本文として認識するために、ある程度の文字数が必要になります。</p>
    <p>段落を複数用意して、記事らしい構造を作ります。</p>
    <p>技術記事のパーサーをテストしています。HTMLからMarkdownへの変換を検証します。</p>
    <p>最後の段落です。これで十分な本文量になるはずです。</p>
  </article>
</body>
</html>
`;

/** OGPメタタグなしのHTML */
const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>最小限の記事</title>
</head>
<body>
  <article>
    <h1>最小限の記事</h1>
    <p>本文のみの記事です。メタ情報はありません。</p>
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
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseGeneric", () => {
  describe("正常系", () => {
    it("HTMLから記事情報を抽出してMarkdownに変換できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });
      const url = "https://example.com/article";

      // Act
      const result = await parseGeneric(url);

      // Assert
      expect(result.title).toBe("テスト記事タイトル");
      expect(result.content).toContain("テスト記事の本文");
      expect(result.source).toBe("example.com");
    });

    it("OGPメタタグからサムネイルURLを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });

      // Act
      const result = await parseGeneric("https://example.com/article");

      // Assert
      expect(result.thumbnailUrl).toBe("https://example.com/thumb.jpg");
    });

    it("OGPメタタグから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });

      // Act
      const result = await parseGeneric("https://example.com/article");

      // Assert
      expect(result.author).toBe("テスト著者");
    });

    it("OGPメタタグから公開日を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });

      // Act
      const result = await parseGeneric("https://example.com/article");

      // Assert
      expect(result.publishedAt).toBe("2024-06-15T10:00:00Z");
    });

    it("読了時間が計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });

      // Act
      const result = await parseGeneric("https://example.com/article");

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("sourceにドメイン名が設定されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });

      // Act
      const result = await parseGeneric("https://blog.example.co.jp/article");

      // Assert
      expect(result.source).toBe("blog.example.co.jp");
    });
  });

  describe("OGPメタタグなし", () => {
    it("メタタグがない場合でも記事を抽出できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_HTML),
      });

      // Act
      const result = await parseGeneric("https://example.com/article");

      // Assert
      expect(result.title).toBe("最小限の記事");
      expect(result.content).toContain("本文のみの記事");
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

      // Act & Assert
      await expect(parseGeneric("https://example.com/not-found")).rejects.toThrow(
        "HTMLの取得に失敗しました",
      );
    });

    it("本文が抽出できない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_CONTENT_HTML),
      });

      // Act & Assert
      await expect(parseGeneric("https://example.com/empty")).rejects.toThrow(
        "記事本文の抽出に失敗しました",
      );
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Act & Assert
      await expect(parseGeneric("https://example.com/error")).rejects.toThrow();
    });
  });

  describe("SSRF ガード", () => {
    it("0.0.0.0 への fetch は SSRF エラーになること", async () => {
      // Act & Assert
      await expect(parseGeneric("http://0.0.0.0/anything")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("127.0.0.1 への fetch は SSRF エラーになること", async () => {
      await expect(parseGeneric("http://127.0.0.1/anything")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("localhost への fetch は SSRF エラーになること", async () => {
      await expect(parseGeneric("http://localhost/anything")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("10.x.x.x への fetch は SSRF エラーになること", async () => {
      await expect(parseGeneric("http://10.1.2.3/anything")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("192.168.x.x への fetch は SSRF エラーになること", async () => {
      await expect(parseGeneric("http://192.168.1.1/anything")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("172.16.x.x への fetch は SSRF エラーになること", async () => {
      await expect(parseGeneric("http://172.16.0.1/anything")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("169.254.x.x (link-local) への fetch は SSRF エラーになること", async () => {
      await expect(parseGeneric("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("metadata.google.internal への fetch は SSRF エラーになること", async () => {
      await expect(
        parseGeneric("http://metadata.google.internal/computeMetadata/v1/"),
      ).rejects.toThrow("URL のホストが許可されていません");
    });

    it("metadata.azure.com への fetch は SSRF エラーになること", async () => {
      await expect(parseGeneric("http://metadata.azure.com/metadata/instance")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("[::1] (IPv6 loopback) への fetch は SSRF エラーになること", async () => {
      await expect(parseGeneric("http://[::1]/anything")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("[fe80::1] (IPv6 link-local) への fetch は SSRF エラーになること", async () => {
      await expect(parseGeneric("http://[fe80::1]/anything")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("file:// プロトコルは SSRF エラーになること", async () => {
      await expect(parseGeneric("file:///etc/passwd")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("ftp:// プロトコルは SSRF エラーになること", async () => {
      await expect(parseGeneric("ftp://example.com/file")).rejects.toThrow(
        "URL のホストが許可されていません",
      );
    });

    it("公開アドレス（example.com）は SSRF 判定されないこと", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });

      // Act
      const result = await parseGeneric("https://example.com/article");

      // Assert
      expect(result.title).toBe("テスト記事タイトル");
    });
  });

  describe("Markdown変換", () => {
    it("変換結果がMarkdown形式であること", async () => {
      // Arrange
      const htmlWithFormatting = `
<!DOCTYPE html>
<html>
<head><title>書式付き記事</title></head>
<body>
  <article>
    <h1>書式付き記事</h1>
    <h2>セクション1</h2>
    <p>通常のテキストと<strong>太字</strong>と<em>イタリック</em>があります。</p>
    <p>追加の段落です。Readabilityが認識できるようにします。</p>
    <p>さらに段落を追加します。テストの信頼性を高めます。</p>
    <ul>
      <li>リスト項目1</li>
      <li>リスト項目2</li>
    </ul>
    <p>最後の段落です。十分な量のコンテンツです。</p>
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlWithFormatting),
      });

      // Act
      const result = await parseGeneric("https://example.com/formatted");

      // Assert
      expect(result.content).toContain("**太字**");
      expect(result.content).toContain("_イタリック_");
    });
  });
});

describe("SSRF 対策", () => {
  it("localhost への fetch をブロックすること", async () => {
    // Act & Assert
    await expect(parseGeneric("http://localhost/secret")).rejects.toThrow(
      "URL のホストが許可されていません",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("127.0.0.1 への fetch をブロックすること", async () => {
    // Act & Assert
    await expect(parseGeneric("http://127.0.0.1/secret")).rejects.toThrow(
      "URL のホストが許可されていません",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("10.x.x.x プライベートアドレスへの fetch をブロックすること", async () => {
    // Act & Assert
    await expect(parseGeneric("http://10.0.0.1/secret")).rejects.toThrow(
      "URL のホストが許可されていません",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("192.168.x.x プライベートアドレスへの fetch をブロックすること", async () => {
    // Act & Assert
    await expect(parseGeneric("http://192.168.1.1/secret")).rejects.toThrow(
      "URL のホストが許可されていません",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("metadata.google.internal への fetch をブロックすること", async () => {
    // Act & Assert
    await expect(
      parseGeneric("http://metadata.google.internal/computeMetadata/v1/"),
    ).rejects.toThrow("URL のホストが許可されていません");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("パブリック URL への fetch は許可すること", async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(SAMPLE_HTML),
    });

    // Act
    const result = await parseGeneric("https://example.com/article");

    // Assert
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.source).toBe("example.com");
  });
});

describe("SSRF リダイレクト対策", () => {
  it("302 リダイレクト先がプライベート IP の場合エラーになること", async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: new Headers({ Location: "http://169.254.169.254/latest/meta-data/" }),
    });

    // Act & Assert
    await expect(parseGeneric("https://example.com/redirect")).rejects.toThrow("SSRF ブロック");
  });

  it("リダイレクト回数が上限を超えた場合エラーになること", async () => {
    // Arrange
    const redirectResponse = {
      ok: false,
      status: 302,
      headers: new Headers({ Location: "https://example.com/hop" }),
    };
    for (let i = 0; i < 6; i++) {
      mockFetch.mockResolvedValueOnce(redirectResponse);
    }

    // Act & Assert
    await expect(parseGeneric("https://example.com/infinite-redirect")).rejects.toThrow(
      "SSRF ブロック",
    );
  });

  it("正常な 302 リダイレクトはパブリック URL なら follow できること", async () => {
    // Arrange
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ Location: "https://example.com/final" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HTML),
      });

    // Act
    const result = await parseGeneric("https://example.com/redirect");

    // Assert
    expect(result.title).toBe("テスト記事タイトル");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
