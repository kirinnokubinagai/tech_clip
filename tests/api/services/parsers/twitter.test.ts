import { beforeEach, describe, expect, it, vi } from "vitest";

import { isTwitterUrl, parseTwitter } from "../../../../apps/api/src/services/parsers/twitter";

describe("isTwitterUrl", () => {
  it("x.com の投稿URLを有効と判定すること", () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";

    // Act
    const result = isTwitterUrl(url);

    // Assert
    expect(result).toBe(true);
  });

  it("twitter.com の投稿URLを有効と判定すること", () => {
    // Arrange
    const url = "https://twitter.com/testuser/status/9876543210";

    // Act
    const result = isTwitterUrl(url);

    // Assert
    expect(result).toBe(true);
  });

  it("プロフィールURLを無効と判定すること", () => {
    // Arrange
    const url = "https://x.com/testuser";

    // Act
    const result = isTwitterUrl(url);

    // Assert
    expect(result).toBe(false);
  });

  it("他サイトのURLを無効と判定すること", () => {
    // Arrange
    const url = "https://example.com/status/123";

    // Act
    const result = isTwitterUrl(url);

    // Assert
    expect(result).toBe(false);
  });

  it("www.x.com の投稿URLを有効と判定すること", () => {
    // Arrange
    const url = "https://www.x.com/testuser/status/1234567890";

    // Act
    const result = isTwitterUrl(url);

    // Assert
    expect(result).toBe(true);
  });

  it("www.twitter.com の投稿URLを有効と判定すること", () => {
    // Arrange
    const url = "https://www.twitter.com/testuser/status/9876543210";

    // Act
    const result = isTwitterUrl(url);

    // Assert
    expect(result).toBe(true);
  });
});

describe("extractTextFromOEmbed（parseTwitter経由）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("&mdash; が — に変換されること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const mockResponse = {
      html: "<blockquote><p>テスト &mdash; 本文</p></blockquote>",
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseTwitter(url);

    // Assert
    expect(result.content).toContain("—");
  });

  it("&nbsp; がノーブレークスペースに変換されること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const mockResponse = {
      html: "<blockquote><p>テスト&nbsp;本文</p></blockquote>",
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseTwitter(url);

    // Assert
    expect(result.content).toContain("\u00a0");
  });

  it("&hellip; が … に変換されること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const mockResponse = {
      html: "<blockquote><p>テスト&hellip;</p></blockquote>",
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseTwitter(url);

    // Assert
    expect(result.content).toContain("…");
  });

  it("数値エンティティ &#8212; が — に変換されること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const mockResponse = {
      html: "<blockquote><p>テスト &#8212; 本文</p></blockquote>",
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseTwitter(url);

    // Assert
    expect(result.content).toContain("—");
  });

  it("16進数エンティティ &#x2014; が — に変換されること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const mockResponse = {
      html: "<blockquote><p>テスト &#x2014; 本文</p></blockquote>",
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseTwitter(url);

    // Assert
    expect(result.content).toContain("—");
  });
});

describe("calculateReadingTime（parseTwitter経由）", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("短いテキストで最小読了時間1分になること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const mockResponse = {
      html: "<blockquote><p>短い</p></blockquote>",
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseTwitter(url);

    // Assert
    expect(result.readingTimeMinutes).toBe(1);
  });

  it("500文字超のテキストで読了時間が2分以上になること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const longText = "あ".repeat(501);
    const mockResponse = {
      html: `<blockquote><p>${longText}</p></blockquote>`,
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseTwitter(url);

    // Assert
    expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(2);
  });
});

describe("parseTwitter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("oEmbed APIからツイート本文を取得できること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const mockResponse = {
      html: "<blockquote><p>テスト投稿の本文です</p>&mdash; テストユーザー (@testuser)</blockquote>",
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseTwitter(url);

    // Assert
    expect(result.title).toBe("テストユーザーのポスト");
    expect(result.author).toBe("テストユーザー");
    expect(result.content).toContain("テスト投稿の本文です");
    expect(result.readingTimeMinutes).toBe(1);
  });

  it("抜粋が200文字を超える場合に切り詰めること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const longText = "あ".repeat(250);
    const mockResponse = {
      html: `<blockquote><p>${longText}</p></blockquote>`,
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseTwitter(url);

    // Assert
    expect(result.excerpt).toHaveLength(203);
    expect(result.excerpt).toMatch(/\.\.\.$/);
  });

  it("抜粋が200文字以内の場合はそのまま返すこと", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const shortText = "あ".repeat(100);
    const mockResponse = {
      html: `<blockquote><p>${shortText}</p></blockquote>`,
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseTwitter(url);

    // Assert
    expect(result.excerpt).toBe(shortText);
  });

  it("不正なURLでエラーになること", async () => {
    // Arrange
    const url = "https://example.com/not-twitter";

    // Act & Assert
    await expect(parseTwitter(url)).rejects.toThrow("Twitter/XのURLではありません");
  });

  it("oEmbed API失敗時にエラーになること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    // Act & Assert
    await expect(parseTwitter(url)).rejects.toThrow("ツイートの取得に失敗しました");
  });

  it("oEmbed APIレスポンスが不正な形式の場合エラーになること", async () => {
    // Arrange
    const url = "https://x.com/testuser/status/1234567890";
    const invalidResponse = { unexpected_field: "value" };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(invalidResponse), { status: 200 }),
    );

    // Assert
    await expect(parseTwitter(url)).rejects.toThrow("oEmbed APIレスポンスの形式が不正です");
  });
});
