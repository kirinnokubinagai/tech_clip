import { describe, expect, it } from "vitest";
import { CreateTagSchema, UpdateArticleTagsSchema } from "../../src/validators/tags";

describe("CreateTagSchema", () => {
  describe("正常系", () => {
    it("有効なタグ名でバリデーションが通ること", () => {
      // Arrange
      const input = { name: "TypeScript" };

      // Act
      const result = CreateTagSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("TypeScript");
    });

    it("日本語タグ名でバリデーションが通ること", () => {
      // Arrange
      const input = { name: "フロントエンド" };

      // Act
      const result = CreateTagSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("フロントエンド");
    });

    it("前後の空白がトリムされること", () => {
      // Arrange
      const input = { name: "  React  " };

      // Act
      const result = CreateTagSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("React");
    });

    it("50文字のタグ名でバリデーションが通ること", () => {
      // Arrange
      const input = { name: "a".repeat(50) };

      // Act
      const result = CreateTagSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("nameが空文字の場合エラーになること", () => {
      // Arrange
      const input = { name: "" };

      // Act
      const result = CreateTagSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("タグ名");
    });

    it("nameが50文字を超える場合エラーになること", () => {
      // Arrange
      const input = { name: "a".repeat(51) };

      // Act
      const result = CreateTagSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("50");
    });

    it("nameが未指定の場合エラーになること", () => {
      // Arrange
      const input = {};

      // Act
      const result = CreateTagSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("UpdateArticleTagsSchema", () => {
  describe("正常系", () => {
    it("空の配列でバリデーションが通ること", () => {
      // Arrange
      const input = { tagIds: [] };

      // Act
      const result = UpdateArticleTagsSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.tagIds).toEqual([]);
    });

    it("タグIDの配列でバリデーションが通ること", () => {
      // Arrange
      const input = { tagIds: ["tag_001", "tag_002", "tag_003"] };

      // Act
      const result = UpdateArticleTagsSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.tagIds).toEqual(["tag_001", "tag_002", "tag_003"]);
    });
  });

  describe("異常系", () => {
    it("tagIdsが未指定の場合エラーになること", () => {
      // Arrange
      const input = {};

      // Act
      const result = UpdateArticleTagsSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("tagIdsが配列でない場合エラーになること", () => {
      // Arrange
      const input = { tagIds: "tag_001" };

      // Act
      const result = UpdateArticleTagsSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("tagIdsに数値が含まれる場合エラーになること", () => {
      // Arrange
      const input = { tagIds: [1, 2, 3] };

      // Act
      const result = UpdateArticleTagsSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});
