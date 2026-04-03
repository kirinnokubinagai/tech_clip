import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { parseArticle } from "../../../apps/api/src/services/article-parser";
import * as sourceDetectorModule from "../../../apps/api/src/services/source-detector";

vi.mock("../../../apps/api/src/services/source-detector", () => ({
  detectSource: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/generic", () => ({
  parseGeneric: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/zenn", () => ({
  parseZenn: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/zenn-book", () => ({
  parseZennBook: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/qiita", () => ({
  parseQiita: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/note", () => ({
  parseNote: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/hatena", () => ({
  parseHatena: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/devto", () => ({
  parseDevto: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/medium", () => ({
  parseMedium: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/github", () => ({
  parseGitHub: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/hackernews", () => ({
  parseHackerNews: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/hashnode", () => ({
  parseHashnode: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/stackoverflow", () => ({
  parseStackOverflow: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/reddit", () => ({
  parseReddit: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/freecodecamp", () => ({
  parseFreecodecamp: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/logrocket", () => ({
  parseLogrocket: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/css-tricks", () => ({
  parseCssTricks: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/smashing", () => ({
  parseSmashing: vi.fn(),
}));

vi.mock("../../../apps/api/src/services/parsers/speakerdeck", () => ({
  parseSpeakerdeck: vi.fn(),
}));

/** モック化されたdetectSource */
const mockDetectSource = sourceDetectorModule.detectSource as Mock;

/** テスト用のパース結果 */
const MOCK_PARSE_RESULT = {
  title: "テスト記事",
  content: "<p>テスト本文</p>",
  excerpt: "テスト本文",
  author: "テストユーザー",
  thumbnailUrl: "https://example.com/thumb.jpg",
  publishedAt: "2024-01-01T00:00:00Z",
  readingTimeMinutes: 3,
  source: "zenn.dev",
};

describe("parseArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ソース別パーサーへのディスパッチ", () => {
    it("Zenn URLがparseZennにディスパッチされること", async () => {
      // Arrange
      const url = "https://zenn.dev/user/articles/example";
      mockDetectSource.mockReturnValue("zenn");
      const { parseZenn } = await import("../../../apps/api/src/services/parsers/zenn");
      (parseZenn as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseZenn).toHaveBeenCalledWith(url);
      expect(result.source).toBe("zenn");
      expect(result.title).toBe("テスト記事");
    });

    it("Qiita URLがparseQiitaにディスパッチされること", async () => {
      // Arrange
      const url = "https://qiita.com/user/items/abc123";
      mockDetectSource.mockReturnValue("qiita");
      const { parseQiita } = await import("../../../apps/api/src/services/parsers/qiita");
      (parseQiita as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseQiita).toHaveBeenCalledWith(url);
      expect(result.source).toBe("qiita");
    });

    it("note URLがparseNoteにディスパッチされること", async () => {
      // Arrange
      const url = "https://note.com/user/n/nxxxxxxx";
      mockDetectSource.mockReturnValue("note");
      const { parseNote } = await import("../../../apps/api/src/services/parsers/note");
      (parseNote as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseNote).toHaveBeenCalledWith(url);
      expect(result.source).toBe("note");
    });

    it("はてなブログ URLがparseHatenaにディスパッチされること", async () => {
      // Arrange
      const url = "https://example.hatenablog.com/entry/2024/01/01/title";
      mockDetectSource.mockReturnValue("hatena");
      const { parseHatena } = await import("../../../apps/api/src/services/parsers/hatena");
      (parseHatena as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseHatena).toHaveBeenCalledWith(url);
      expect(result.source).toBe("hatena");
    });

    it("Dev.to URLがparseDevtoにディスパッチされること", async () => {
      // Arrange
      const url = "https://dev.to/user/article-title";
      mockDetectSource.mockReturnValue("devto");
      const { parseDevto } = await import("../../../apps/api/src/services/parsers/devto");
      (parseDevto as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseDevto).toHaveBeenCalledWith(url);
      expect(result.source).toBe("devto");
    });

    it("Medium URLがparseMediumにディスパッチされること", async () => {
      // Arrange
      const url = "https://medium.com/@user/article-title-abc123";
      mockDetectSource.mockReturnValue("medium");
      const { parseMedium } = await import("../../../apps/api/src/services/parsers/medium");
      (parseMedium as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseMedium).toHaveBeenCalledWith(url);
      expect(result.source).toBe("medium");
    });

    it("GitHub URLがparseGitHubにディスパッチされること", async () => {
      // Arrange
      const url = "https://github.com/user/repo";
      mockDetectSource.mockReturnValue("github");
      const { parseGitHub } = await import("../../../apps/api/src/services/parsers/github");
      (parseGitHub as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseGitHub).toHaveBeenCalledWith(url);
      expect(result.source).toBe("github");
    });

    it("Stack Overflow URLがparseStackOverflowにディスパッチされること", async () => {
      // Arrange
      const url = "https://stackoverflow.com/questions/12345/title";
      mockDetectSource.mockReturnValue("stackoverflow");
      const { parseStackOverflow } = await import(
        "../../../apps/api/src/services/parsers/stackoverflow"
      );
      (parseStackOverflow as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseStackOverflow).toHaveBeenCalledWith(url);
      expect(result.source).toBe("stackoverflow");
    });

    it("Hacker News URLがparseHackerNewsにディスパッチされること", async () => {
      // Arrange
      const url = "https://news.ycombinator.com/item?id=12345";
      mockDetectSource.mockReturnValue("hackernews");
      const { parseHackerNews } = await import("../../../apps/api/src/services/parsers/hackernews");
      (parseHackerNews as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseHackerNews).toHaveBeenCalledWith(url);
      expect(result.source).toBe("hackernews");
    });

    it("Hashnode URLがparseHashnodeにディスパッチされること", async () => {
      // Arrange
      const url = "https://hashnode.com/post/example-post";
      mockDetectSource.mockReturnValue("hashnode");
      const { parseHashnode } = await import("../../../apps/api/src/services/parsers/hashnode");
      (parseHashnode as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseHashnode).toHaveBeenCalledWith(url);
      expect(result.source).toBe("hashnode");
    });

    it("Reddit URLがparseRedditにディスパッチされること", async () => {
      // Arrange
      const url = "https://www.reddit.com/r/programming/comments/abc123/title";
      mockDetectSource.mockReturnValue("reddit");
      const { parseReddit } = await import("../../../apps/api/src/services/parsers/reddit");
      (parseReddit as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseReddit).toHaveBeenCalledWith(url);
      expect(result.source).toBe("reddit");
    });

    it("freeCodeCamp URLがparseFreecodecamp にディスパッチされること", async () => {
      // Arrange
      const url = "https://www.freecodecamp.org/news/article-title";
      mockDetectSource.mockReturnValue("freecodecamp");
      const { parseFreecodecamp } = await import(
        "../../../apps/api/src/services/parsers/freecodecamp"
      );
      (parseFreecodecamp as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseFreecodecamp).toHaveBeenCalledWith(url);
      expect(result.source).toBe("freecodecamp");
    });

    it("LogRocket URLがparseLogrocketにディスパッチされること", async () => {
      // Arrange
      const url = "https://blog.logrocket.com/article-title";
      mockDetectSource.mockReturnValue("logrocket");
      const { parseLogrocket } = await import("../../../apps/api/src/services/parsers/logrocket");
      (parseLogrocket as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseLogrocket).toHaveBeenCalledWith(url);
      expect(result.source).toBe("logrocket");
    });

    it("CSS-Tricks URLがparseCssTricksにディスパッチされること", async () => {
      // Arrange
      const url = "https://css-tricks.com/article-title";
      mockDetectSource.mockReturnValue("css-tricks");
      const { parseCssTricks } = await import("../../../apps/api/src/services/parsers/css-tricks");
      (parseCssTricks as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseCssTricks).toHaveBeenCalledWith(url);
      expect(result.source).toBe("css-tricks");
    });

    it("Smashing Magazine URLがparseSmashingにディスパッチされること", async () => {
      // Arrange
      const url = "https://www.smashingmagazine.com/article-title";
      mockDetectSource.mockReturnValue("smashing");
      const { parseSmashing } = await import("../../../apps/api/src/services/parsers/smashing");
      (parseSmashing as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseSmashing).toHaveBeenCalledWith(url);
      expect(result.source).toBe("smashing");
    });

    it("SpeakerDeck URLがparseSpeakerdeckにディスパッチされること", async () => {
      // Arrange
      const url = "https://speakerdeck.com/user/slide-title";
      mockDetectSource.mockReturnValue("speakerdeck");
      const { parseSpeakerdeck } = await import(
        "../../../apps/api/src/services/parsers/speakerdeck"
      );
      (parseSpeakerdeck as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseSpeakerdeck).toHaveBeenCalledWith(url);
      expect(result.source).toBe("speakerdeck");
    });
  });

  describe("汎用パーサーへのフォールバック", () => {
    it("未知のURLがparseGenericで処理されること", async () => {
      // Arrange
      const url = "https://example.com/article";
      mockDetectSource.mockReturnValue("other");
      const { parseGeneric } = await import("../../../apps/api/src/services/parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseGeneric).toHaveBeenCalledWith(url);
      expect(result.source).toBe("other");
      expect(result.title).toBe("テスト記事");
    });

    it("個別パーサーがエラーを投げた場合にparseGenericにフォールバックすること", async () => {
      // Arrange
      const url = "https://zenn.dev/user/articles/example";
      mockDetectSource.mockReturnValue("zenn");
      const { parseZenn } = await import("../../../apps/api/src/services/parsers/zenn");
      (parseZenn as Mock).mockRejectedValue(new Error("Zenn記事の取得に失敗しました"));
      const { parseGeneric } = await import("../../../apps/api/src/services/parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseZenn).toHaveBeenCalledWith(url);
      expect(parseGeneric).toHaveBeenCalledWith(url);
      expect(result.title).toBe("テスト記事");
    });

    it("個別パーサーとgenericパーサー両方がエラーを投げた場合そのまま伝播すること", async () => {
      // Arrange
      const url = "https://zenn.dev/user/articles/example";
      mockDetectSource.mockReturnValue("zenn");
      const { parseZenn } = await import("../../../apps/api/src/services/parsers/zenn");
      (parseZenn as Mock).mockRejectedValue(new Error("Zenn記事の取得に失敗しました"));
      const { parseGeneric } = await import("../../../apps/api/src/services/parsers/generic");
      (parseGeneric as Mock).mockRejectedValue(new Error("HTMLの取得に失敗しました"));

      // Act & Assert
      await expect(parseArticle(url)).rejects.toThrow("HTMLの取得に失敗しました");
    });
  });

  describe("パース結果の構造", () => {
    it("sourceフィールドがdetectSourceの結果で設定されること", async () => {
      // Arrange
      const url = "https://zenn.dev/user/articles/example";
      mockDetectSource.mockReturnValue("zenn");
      const { parseZenn } = await import("../../../apps/api/src/services/parsers/zenn");
      (parseZenn as Mock).mockResolvedValue({
        ...MOCK_PARSE_RESULT,
        source: "zenn.dev",
      });

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(result.source).toBe("zenn");
    });

    it("パース結果のフィールドが保持されること", async () => {
      // Arrange
      const url = "https://example.com/article";
      mockDetectSource.mockReturnValue("other");
      const { parseGeneric } = await import("../../../apps/api/src/services/parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(result).toMatchObject({
        title: "テスト記事",
        content: "<p>テスト本文</p>",
        excerpt: "テスト本文",
        author: "テストユーザー",
        thumbnailUrl: "https://example.com/thumb.jpg",
        publishedAt: "2024-01-01T00:00:00Z",
        source: "other",
      });
    });
  });

  describe("エラーハンドリング", () => {
    it("otherソースのgenericパーサーがエラーを投げた場合そのまま伝播すること", async () => {
      // Arrange
      const url = "https://example.com/article";
      mockDetectSource.mockReturnValue("other");
      const { parseGeneric } = await import("../../../apps/api/src/services/parsers/generic");
      (parseGeneric as Mock).mockRejectedValue(new Error("記事の取得に失敗しました"));

      // Act & Assert
      await expect(parseArticle(url)).rejects.toThrow("記事の取得に失敗しました");
    });
  });
});
