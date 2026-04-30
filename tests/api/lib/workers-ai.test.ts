import { extractTextResponse, isWorkersAiTextResponse } from "@api/lib/workers-ai";
import { describe, expect, it } from "vitest";

describe("isWorkersAiTextResponse", () => {
  describe("旧形式 { response: string }", () => {
    it("response フィールドを持つオブジェクトは true を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse({ response: "テキスト" });

      // Assert
      expect(result).toBe(true);
    });

    it("response が空文字列の場合も true を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse({ response: "" });

      // Assert
      expect(result).toBe(true);
    });

    it("response が string でない場合は false を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse({ response: 42 });

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("新形式 { choices: [{ message: { content: string } }] }", () => {
    it("choices 形式は true を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse({
        choices: [{ message: { content: "応答テキスト" } }],
      });

      // Assert
      expect(result).toBe(true);
    });

    it("choices が複数ある場合も true を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse({
        choices: [{ message: { content: "最初の応答" } }, { message: { content: "2番目の応答" } }],
      });

      // Assert
      expect(result).toBe(true);
    });

    it("choices が空配列の場合は false を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse({ choices: [] });

      // Assert
      expect(result).toBe(false);
    });

    it("choices[0].message が存在しない場合は false を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse({ choices: [{}] });

      // Assert
      expect(result).toBe(false);
    });

    it("choices[0].message.content が string でない場合は false を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse({ choices: [{ message: { content: null } }] });

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("非テキスト応答", () => {
    it("null は false を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse(null);

      // Assert
      expect(result).toBe(false);
    });

    it("undefined は false を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse(undefined);

      // Assert
      expect(result).toBe(false);
    });

    it("文字列は false を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse("text");

      // Assert
      expect(result).toBe(false);
    });

    it("数値は false を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse(42);

      // Assert
      expect(result).toBe(false);
    });

    it("空オブジェクトは false を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse({});

      // Assert
      expect(result).toBe(false);
    });

    it("関係のないフィールドのみのオブジェクトは false を返すこと", () => {
      // Arrange & Act
      const result = isWorkersAiTextResponse({ data: "something" });

      // Assert
      expect(result).toBe(false);
    });
  });
});

describe("extractTextResponse", () => {
  describe("旧形式 { response: string }", () => {
    it("response フィールドの文字列を返すこと", () => {
      // Arrange & Act
      const result = extractTextResponse({ response: "テキスト応答" });

      // Assert
      expect(result).toBe("テキスト応答");
    });

    it("空文字列の response を返すこと", () => {
      // Arrange & Act
      const result = extractTextResponse({ response: "" });

      // Assert
      expect(result).toBe("");
    });
  });

  describe("新形式 { choices: [{ message: { content: string } }] }", () => {
    it("choices[0].message.content を返すこと", () => {
      // Arrange & Act
      const result = extractTextResponse({
        choices: [{ message: { content: "チャット応答" } }],
      });

      // Assert
      expect(result).toBe("チャット応答");
    });

    it("choices が複数ある場合は最初の content を返すこと", () => {
      // Arrange & Act
      const result = extractTextResponse({
        choices: [{ message: { content: "最初" } }, { message: { content: "2番目" } }],
      });

      // Assert
      expect(result).toBe("最初");
    });
  });

  describe("旧形式と新形式が両方ある場合", () => {
    it("response フィールドを優先して返すこと", () => {
      // Arrange & Act
      const result = extractTextResponse({
        response: "旧形式優先",
        choices: [{ message: { content: "新形式" } }],
      } as Parameters<typeof extractTextResponse>[0]);

      // Assert
      expect(result).toBe("旧形式優先");
    });
  });
});
