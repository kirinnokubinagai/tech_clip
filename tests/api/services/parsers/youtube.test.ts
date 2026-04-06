import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseYoutube } from "../../../../apps/api/src/services/parsers/youtube";

describe("parseYoutube", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("oEmbed APIからメタデータを取得できること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const mockResponse = {
      title: "テスト動画タイトル",
      author_name: "テストチャンネル",
      author_url: "https://www.youtube.com/@testchannel",
      thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    // Act
    const result = await parseYoutube(url);

    // Assert
    expect(result.title).toBe("テスト動画タイトル");
    expect(result.author).toBe("テストチャンネル");
    expect(result.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(result.content).toBeNull();
    expect(result.excerpt).toContain("テストチャンネル");
    expect(result.excerpt).toContain("テスト動画タイトル");
  });

  it("モバイルURL（m.youtube.com）からメタデータを取得できること", async () => {
    // Arrange
    const url = "https://m.youtube.com/watch?v=dQw4w9WgXcQ";
    const mockResponse = {
      title: "モバイルテスト動画",
      author_name: "テストチャンネル",
      author_url: "https://www.youtube.com/@testchannel",
      thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    // Act
    const result = await parseYoutube(url);

    // Assert
    expect(result.title).toBe("モバイルテスト動画");
    expect(result.author).toBe("テストチャンネル");
    expect(result.excerpt).toContain("テストチャンネル");
  });

  it("oEmbed API失敗時にエラーになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=invalid";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    // Act & Assert
    await expect(parseYoutube(url)).rejects.toThrow("YouTube動画の取得に失敗しました");
  });

  it("thumbnail_urlが存在しない場合thumbnailUrlがnullになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const mockResponse = {
      title: "テスト動画タイトル",
      author_name: "テストチャンネル",
      author_url: "https://www.youtube.com/@testchannel",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    // Act
    const result = await parseYoutube(url);

    // Assert
    expect(result.thumbnailUrl).toBeNull();
  });

  it("titleが欠落しているレスポンスでエラーになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const mockResponse = {
      author_name: "テストチャンネル",
      author_url: "https://www.youtube.com/@testchannel",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    // Act & Assert
    await expect(parseYoutube(url)).rejects.toThrow("YouTube動画のメタデータが不正です");
  });

  it("author_nameが欠落しているレスポンスでエラーになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const mockResponse = {
      title: "テスト動画タイトル",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    // Act & Assert
    await expect(parseYoutube(url)).rejects.toThrow("YouTube動画のメタデータが不正です");
  });

  it("空オブジェクトのレスポンスでエラーになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    // Act & Assert
    await expect(parseYoutube(url)).rejects.toThrow("YouTube動画のメタデータが不正です");
  });

  it("タイムアウト時にエラーになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=timeout";
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new DOMException("The operation was aborted", "TimeoutError"),
    );

    // Act & Assert
    await expect(parseYoutube(url)).rejects.toThrow();
  });

  it("youtu.be短縮URLからメタデータを取得できること", async () => {
    // Arrange
    const url = "https://youtu.be/dQw4w9WgXcQ";
    const mockResponse = {
      title: "短縮URLテスト動画",
      author_name: "テストチャンネル",
      author_url: "https://www.youtube.com/@testchannel",
      thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    // Act
    const result = await parseYoutube(url);

    // Assert
    expect(result.title).toBe("短縮URLテスト動画");
    expect(result.author).toBe("テストチャンネル");
    expect(result.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(result.excerpt).toContain("テストチャンネル");
    expect(result.excerpt).toContain("短縮URLテスト動画");
  });
});
