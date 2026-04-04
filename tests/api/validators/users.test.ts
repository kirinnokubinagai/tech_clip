import { UpdateProfileSchema, UploadAvatarSchema } from "@api/validators/users";
import { describe, expect, it } from "vitest";

describe("UpdateProfileSchema", () => {
  describe("正常系", () => {
    it("nameのみ指定でバリデーションが通ること", () => {
      // Arrange
      const input = { name: "テストユーザー" };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("テストユーザー");
    });

    it("usernameのみ指定でバリデーションが通ること", () => {
      // Arrange
      const input = { username: "test_user-123" };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.username).toBe("test_user-123");
    });

    it("bioのみ指定でバリデーションが通ること", () => {
      // Arrange
      const input = { bio: "自己紹介テキスト" };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });

    it("websiteUrlのみ指定でバリデーションが通ること", () => {
      // Arrange
      const input = { websiteUrl: "https://example.com" };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });

    it("nullを渡してフィールドをクリアできること", () => {
      // Arrange
      const input = { name: null, bio: null };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.name).toBeNull();
    });

    it("すべてのフィールドを指定してバリデーションが通ること", () => {
      // Arrange
      const input = {
        name: "テストユーザー",
        username: "test_user",
        bio: "自己紹介",
        websiteUrl: "https://example.com",
        githubUsername: "testuser",
        twitterUsername: "testuser",
        isProfilePublic: true,
        preferredLanguage: "ja",
      };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("nameが100文字を超える場合エラーになること", () => {
      // Arrange
      const input = { name: "あ".repeat(101) };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("100");
    });

    it("usernameに使用不可文字が含まれる場合エラーになること", () => {
      // Arrange
      const input = { username: "invalid user!" };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("半角英数字");
    });

    it("usernameが30文字を超える場合エラーになること", () => {
      // Arrange
      const input = { username: "a".repeat(31) };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("30");
    });

    it("bioが500文字を超える場合エラーになること", () => {
      // Arrange
      const input = { bio: "あ".repeat(501) };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("500");
    });

    it("websiteUrlがURL形式でない場合エラーになること", () => {
      // Arrange
      const input = { websiteUrl: "not-a-url" };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("URL");
    });

    it("githubUsernameが39文字を超える場合エラーになること", () => {
      // Arrange
      const input = { githubUsername: "a".repeat(40) };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("39");
    });

    it("twitterUsernameが15文字を超える場合エラーになること", () => {
      // Arrange
      const input = { twitterUsername: "a".repeat(16) };

      // Act
      const result = UpdateProfileSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("15");
    });
  });
});

describe("UploadAvatarSchema", () => {
  describe("正常系", () => {
    it("有効なJPEGファイルでバリデーションが通ること", () => {
      // Arrange
      const mockFile = new File(["data"], "avatar.jpg", { type: "image/jpeg" });
      const input = { avatar: mockFile };

      // Act
      const result = UploadAvatarSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });

    it("有効なPNGファイルでバリデーションが通ること", () => {
      // Arrange
      const mockFile = new File(["data"], "avatar.png", { type: "image/png" });
      const input = { avatar: mockFile };

      // Act
      const result = UploadAvatarSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("avatarフィールドが未指定の場合エラーになること", () => {
      // Arrange
      const input = {};

      // Act
      const result = UploadAvatarSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("avatarが文字列の場合エラーになること", () => {
      // Arrange
      const input = { avatar: "not-a-file" };

      // Act
      const result = UploadAvatarSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});
