import { parseStackOverflow } from "@api/services/parsers/stackoverflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** SO APIレスポンスのモックデータ（accepted_answer付き） */
const SAMPLE_SO_QUESTION_WITH_ANSWER = {
  items: [
    {
      question_id: 12345678,
      title: "How to parse JSON in TypeScript?",
      body: "<p>I want to parse JSON safely in TypeScript.</p><pre><code>const data = JSON.parse(str);</code></pre>",
      owner: {
        display_name: "john_doe",
      },
      accepted_answer_id: 99999999,
      creation_date: 1719849600,
      answers: [
        {
          answer_id: 99999999,
          body: "<p>You can use <code>JSON.parse</code> with a type guard.</p><pre><code>function parse(s: string): unknown {\n  return JSON.parse(s);\n}</code></pre>",
          is_accepted: true,
          owner: {
            display_name: "jane_smith",
          },
          score: 42,
        },
        {
          answer_id: 88888888,
          body: "<p>Another approach is using zod.</p>",
          is_accepted: false,
          owner: {
            display_name: "bob",
          },
          score: 10,
        },
      ],
    },
  ],
  has_more: false,
  quota_max: 300,
  quota_remaining: 299,
};

/** SO APIレスポンスのモックデータ（accepted_answerなし） */
const SAMPLE_SO_QUESTION_NO_ANSWER = {
  items: [
    {
      question_id: 11111111,
      title: "Why does TypeScript not infer this type?",
      body: "<p>TypeScript fails to infer the type in this case.</p>",
      owner: {
        display_name: "alice",
      },
      creation_date: 1719936000,
      answers: [],
    },
  ],
  has_more: false,
  quota_max: 300,
  quota_remaining: 298,
};

/** SO APIレスポンスのモックデータ（ownerなし） */
const SAMPLE_SO_QUESTION_NO_OWNER = {
  items: [
    {
      question_id: 22222222,
      title: "Deleted user question",
      body: "<p>Some question body.</p>",
      creation_date: 1719849600,
      answers: [],
    },
  ],
  has_more: false,
  quota_max: 300,
  quota_remaining: 297,
};

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseStackOverflow", () => {
  describe("URL解析", () => {
    it("Stack Overflow以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/questions/12345";

      // Act & Assert
      await expect(parseStackOverflow(url)).rejects.toThrow("Stack Overflow");
    });

    it("question_idが含まれないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://stackoverflow.com/";

      // Act & Assert
      await expect(parseStackOverflow(url)).rejects.toThrow("question_id");
    });

    it("question_idが数値でないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://stackoverflow.com/questions/abc/some-title";

      // Act & Assert
      await expect(parseStackOverflow(url)).rejects.toThrow("question_id");
    });
  });

  describe("正常系（accepted_answer付き）", () => {
    it("質問タイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.title).toBe("How to parse JSON in TypeScript?");
    });

    it("質問者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.author).toBe("john_doe");
    });

    it("質問本文とaccepted_answerがMarkdownコンテンツに含まれること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.content).toContain("parse JSON safely");
      expect(result.content).toContain("type guard");
    });

    it("sourceが'stackoverflow.com'であること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.source).toBe("stackoverflow.com");
    });

    it("UNIXタイムスタンプからISO 8601形式の公開日に変換されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.publishedAt).toBe("2024-07-01T16:00:00.000Z");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("正常系（accepted_answerなし）", () => {
    it("回答がない場合でも質問本文のみでコンテンツを返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_NO_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/11111111/why-typescript";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.content).toContain("fails to infer");
      expect(result.title).toBe("Why does TypeScript not infer this type?");
    });
  });

  describe("正常系（ownerなし）", () => {
    it("ownerフィールドがない場合authorがnullになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_NO_OWNER),
      });
      const url = "https://stackoverflow.com/questions/22222222/deleted-user";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.author).toBeNull();
    });
  });

  describe("APIリクエスト", () => {
    it("正しいStack Overflow APIエンドポイントにリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json";

      // Act
      await parseStackOverflow(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api.stackexchange.com/2.3/questions/12345678"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("TechClipBot"),
          }),
        }),
      );
    });

    it("APIリクエストにsite=stackoverflowパラメータが含まれること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json";

      // Act
      await parseStackOverflow(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("site=stackoverflow"),
        expect.anything(),
      );
    });

    it("APIリクエストにfilterパラメータが含まれること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json";

      // Act
      await parseStackOverflow(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("filter="), expect.anything());
    });
  });

  describe("異常系", () => {
    it("SO APIがエラーステータスを返した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });
      const url = "https://stackoverflow.com/questions/99999999/not-found";

      // Act & Assert
      await expect(parseStackOverflow(url)).rejects.toThrow("取得に失敗しました");
    });

    it("SO APIがitems空配列を返した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            has_more: false,
            quota_max: 300,
            quota_remaining: 299,
          }),
      });
      const url = "https://stackoverflow.com/questions/99999999/not-found";

      // Act & Assert
      await expect(parseStackOverflow(url)).rejects.toThrow("質問が見つかりません");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json";

      // Act & Assert
      await expect(parseStackOverflow(url)).rejects.toThrow();
    });
  });

  describe("URL形式バリエーション", () => {
    it("/questions/ID/title形式のURLでパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json-in-typescript";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.title).toBe("How to parse JSON in TypeScript?");
    });

    it("/questions/ID形式のURLでパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.title).toBe("How to parse JSON in TypeScript?");
    });

    it("/q/ID形式の短縮URLでパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/q/12345678";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.title).toBe("How to parse JSON in TypeScript?");
    });

    it("末尾にアンカーがあるURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json#answer-99999999";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.title).toBe("How to parse JSON in TypeScript?");
    });

    it("クエリパラメータ付きURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_SO_QUESTION_WITH_ANSWER),
      });
      const url = "https://stackoverflow.com/questions/12345678/how-to-parse-json?noredirect=1";

      // Act
      const result = await parseStackOverflow(url);

      // Assert
      expect(result.title).toBe("How to parse JSON in TypeScript?");
    });
  });
});
