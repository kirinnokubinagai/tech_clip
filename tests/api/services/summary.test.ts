import { DEFAULT_GEMMA_MODEL_TAG, WORKERS_AI_GEMMA_MODEL_ID } from "@api/lib/ai-model";
import type { SummaryResult } from "@api/services/summary";
import { sanitizeArticleContent, summarizeArticle } from "@api/services/summary";
import { beforeEach, describe, expect, it, vi } from "vitest";

const MOCK_SUMMARY_TEXT = "## 概要\nこの記事はTypeScriptの型システムについて解説しています。";

const MOCK_CONTENT =
  "# TypeScriptの型システム入門\n\nTypeScriptは静的型付け言語です。ジェネリクスを使うことで再利用可能な型を定義できます。";

/**
 * モック Ai バインディングを生成する
 *
 * @param response - run() が返す response 文字列
 * @returns モック Ai オブジェクト
 */
function createMockAi(response: string) {
  return {
    run: vi.fn().mockResolvedValue({ response }),
  } as unknown as Ai;
}

describe("summary service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Workers AI を呼び出して要約を返すこと", async () => {
    // Arrange
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    const result = await summarizeArticle({
      ai,
      content: MOCK_CONTENT,
      language: "ja",
    });

    // Assert
    expect(result.summary).toBe(MOCK_SUMMARY_TEXT);
    expect(result.model).toBe(DEFAULT_GEMMA_MODEL_TAG);
    expect(ai.run).toHaveBeenCalledWith(
      WORKERS_AI_GEMMA_MODEL_ID,
      expect.objectContaining({
        messages: expect.any(Array),
        max_tokens: 1024,
        temperature: 0.3,
      }),
    );
  });

  it("messages 形式（system + user）でリクエストすること", async () => {
    // Arrange
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    await summarizeArticle({
      ai,
      content: MOCK_CONTENT,
      language: "ja",
    });

    // Assert
    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const inputs = call[1] as { messages: Array<{ role: string; content: string }> };
    expect(inputs.messages).toHaveLength(2);
    expect(inputs.messages[0].role).toBe("system");
    expect(inputs.messages[1].role).toBe("user");
    expect(inputs.messages[1].content).toContain("TypeScript");
  });

  it("modelTag override が DB 保存値に反映されること", async () => {
    // Arrange
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    const result = await summarizeArticle({
      ai,
      content: MOCK_CONTENT,
      language: "ja",
      modelTag: "custom-tag",
    });

    // Assert
    expect(result.model).toBe("custom-tag");
  });

  it("コンテンツが MAX_CONTENT_LENGTH を超える場合は切り詰めること", async () => {
    // Arrange
    const longContent = "a".repeat(30000);
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    await summarizeArticle({
      ai,
      content: longContent,
      language: "ja",
    });

    // Assert
    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const inputs = call[1] as { messages: Array<{ role: string; content: string }> };
    const userContent = inputs.messages[1].content;
    expect(userContent.length).toBeLessThan(30000);
  });

  it("Workers AI が例外を投げた場合 '要約の生成に失敗しました' をスローすること", async () => {
    // Arrange
    const ai = {
      run: vi.fn().mockRejectedValue(new Error("Workers AI internal error")),
    } as unknown as Ai;

    // Act & Assert
    await expect(
      summarizeArticle({
        ai,
        content: MOCK_CONTENT,
        language: "ja",
      }),
    ).rejects.toThrow("要約の生成に失敗しました");
  });

  it("language が ja のとき Japanese がプロンプトに含まれること", async () => {
    // Arrange
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    await summarizeArticle({ ai, content: MOCK_CONTENT, language: "ja" });

    // Assert
    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const inputs = call[1] as { messages: Array<{ role: string; content: string }> };
    expect(inputs.messages[0].content).toContain("Japanese");
  });

  it("language が en のとき English がプロンプトに含まれること", async () => {
    // Arrange
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    await summarizeArticle({ ai, content: MOCK_CONTENT, language: "en" });

    // Assert
    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const inputs = call[1] as { messages: Array<{ role: string; content: string }> };
    expect(inputs.messages[0].content).toContain("English");
  });

  it("language が zh のとき Chinese がプロンプトに含まれること", async () => {
    // Arrange
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    await summarizeArticle({ ai, content: MOCK_CONTENT, language: "zh" });

    // Assert
    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const inputs = call[1] as { messages: Array<{ role: string; content: string }> };
    expect(inputs.messages[0].content).toContain("Chinese");
  });

  it("language が ko のとき Korean がプロンプトに含まれること", async () => {
    // Arrange
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    await summarizeArticle({ ai, content: MOCK_CONTENT, language: "ko" });

    // Assert
    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const inputs = call[1] as { messages: Array<{ role: string; content: string }> };
    expect(inputs.messages[0].content).toContain("Korean");
  });

  it("language が zh-CN のとき Simplified Chinese がプロンプトに含まれること", async () => {
    // Arrange
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    await summarizeArticle({ ai, content: MOCK_CONTENT, language: "zh-CN" });

    // Assert
    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const inputs = call[1] as { messages: Array<{ role: string; content: string }> };
    expect(inputs.messages[0].content).toContain("Simplified Chinese");
  });

  it("language が zh-TW のとき Traditional Chinese がプロンプトに含まれること", async () => {
    // Arrange
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    await summarizeArticle({ ai, content: MOCK_CONTENT, language: "zh-TW" });

    // Assert
    const call = (ai.run as ReturnType<typeof vi.fn>).mock.calls[0];
    const inputs = call[1] as { messages: Array<{ role: string; content: string }> };
    expect(inputs.messages[0].content).toContain("Traditional Chinese");
  });

  it("レスポンスの response フィールドが string 以外の場合エラーになること", async () => {
    // Arrange
    const ai = {
      run: vi.fn().mockResolvedValue({ response: null }),
    } as unknown as Ai;

    // Act & Assert
    await expect(
      summarizeArticle({
        ai,
        content: MOCK_CONTENT,
        language: "ja",
      }),
    ).rejects.toThrow("要約の生成に失敗しました");
  });

  it("戻り値が SummaryResult 型であること", async () => {
    // Arrange
    const ai = createMockAi(MOCK_SUMMARY_TEXT);

    // Act
    const result: SummaryResult = await summarizeArticle({
      ai,
      content: MOCK_CONTENT,
      language: "ja",
    });

    // Assert
    expect(typeof result.summary).toBe("string");
    expect(typeof result.model).toBe("string");
  });
});

describe("sanitizeArticleContent", () => {
  it("script タグとその内容を除去できること", () => {
    // Arrange
    const input = '<p>記事本文</p><script>alert("xss")</script>';

    // Act
    const result = sanitizeArticleContent(input);

    // Assert
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
    expect(result).toContain("記事本文");
  });

  it("style タグとその内容を除去できること", () => {
    // Arrange
    const input = "<p>本文</p><style>.a { color: red; }</style>";

    // Act
    const result = sanitizeArticleContent(input);

    // Assert
    expect(result).not.toContain("<style>");
    expect(result).not.toContain("color: red");
    expect(result).toContain("本文");
  });

  it("HTML タグを除去してプレーンテキストにできること", () => {
    // Arrange
    const input = "<h1>タイトル</h1><p>段落<strong>強調</strong>テキスト</p>";

    // Act
    const result = sanitizeArticleContent(input);

    // Assert
    expect(result).not.toContain("<h1>");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<strong>");
    expect(result).toContain("タイトル");
    expect(result).toContain("強調");
  });

  it("HTML エンティティをデコードできること", () => {
    // Arrange
    const input = "1 &amp; 2 &lt;3 &gt;4 &quot;hello&quot; &#039;world&#039;";

    // Act
    const result = sanitizeArticleContent(input);

    // Assert
    expect(result).toContain("1 & 2");
    expect(result).toContain("<3");
    expect(result).toContain(">4");
    expect(result).toContain('"hello"');
    expect(result).toContain("'world'");
  });

  it("MAX_CONTENT_LENGTH を超える場合に切り詰めること", () => {
    // Arrange
    const input = "a".repeat(30000);

    // Act
    const result = sanitizeArticleContent(input);

    // Assert
    expect(result.length).toBeLessThanOrEqual(24000);
  });

  it("連続する空白を1つに正規化できること", () => {
    // Arrange
    const input = "テキスト   複数\n\n空白\t\t含む";

    // Act
    const result = sanitizeArticleContent(input);

    // Assert
    expect(result).not.toMatch(/\s{2}/);
  });
});
