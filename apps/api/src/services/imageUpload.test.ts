import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateUniqueFileName,
  type ImageUploadConfig,
  uploadAvatarToR2,
  validateImageFile,
} from "./imageUpload";

/** テスト用のモックR2バケット */
const mockR2Put = vi.fn();
const mockR2Bucket = {
  put: mockR2Put,
};

/** テスト用のJPEG画像バイナリ（最小限のJPEGヘッダー） */
const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
/** テスト用のPNG画像バイナリ（最小限のPNGヘッダー） */
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
/** テスト用のWebP画像バイナリ（最小限のWebPヘッダー） */
const WEBP_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
/** テスト用の不正ファイルバイナリ */
const INVALID_HEADER = new Uint8Array([0x00, 0x00, 0x00, 0x00]);

/** テスト用の画像アップロード設定 */
const TEST_CONFIG: ImageUploadConfig = {
  r2Bucket: mockR2Bucket as unknown as R2Bucket,
  r2PublicUrl: "https://cdn.example.com",
};

/**
 * テスト用のFileオブジェクトを作成する
 *
 * @param header - ファイルヘッダーバイナリ
 * @param type - MIMEタイプ
 * @param name - ファイル名
 * @returns Fileオブジェクト
 */
function createTestFile(header: Uint8Array, type: string, name: string): File {
  return new File([header], name, { type });
}

describe("validateImageFile", () => {
  describe("正常系", () => {
    it("JPEGファイルを受け付けること", () => {
      // Arrange
      const file = createTestFile(JPEG_HEADER, "image/jpeg", "avatar.jpg");

      // Act
      const result = validateImageFile(file);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("PNGファイルを受け付けること", () => {
      // Arrange
      const file = createTestFile(PNG_HEADER, "image/png", "avatar.png");

      // Act
      const result = validateImageFile(file);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("WebPファイルを受け付けること", () => {
      // Arrange
      const file = createTestFile(WEBP_HEADER, "image/webp", "avatar.webp");

      // Act
      const result = validateImageFile(file);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("異常系", () => {
    it("JPEGでもPNGでもWebPでもないMIMEタイプは拒否されること", () => {
      // Arrange
      const file = createTestFile(INVALID_HEADER, "image/gif", "avatar.gif");

      // Act
      const result = validateImageFile(file);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("jpg/png/webp");
    });

    it("ファイルサイズが上限を超える場合は拒否されること", () => {
      // Arrange
      /** 5MB超のファイルサイズ */
      const OVER_5MB = 5 * 1024 * 1024 + 1;
      const largeData = new Uint8Array(OVER_5MB);
      largeData.set(JPEG_HEADER, 0);
      const file = new File([largeData], "large.jpg", { type: "image/jpeg" });

      // Act
      const result = validateImageFile(file);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("5MB");
    });

    it("ファイルが空の場合は拒否されること", () => {
      // Arrange
      const file = new File([], "empty.jpg", { type: "image/jpeg" });

      // Act
      const result = validateImageFile(file);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("テキストファイルのMIMEタイプは拒否されること", () => {
      // Arrange
      const file = createTestFile(INVALID_HEADER, "text/plain", "avatar.txt");

      // Act
      const result = validateImageFile(file);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe("generateUniqueFileName", () => {
  it("ユニークなファイル名を生成できること", () => {
    // Arrange
    const userId = "user_01HXYZ";
    const extension = "webp";

    // Act
    const fileName = generateUniqueFileName(userId, extension);

    // Assert
    expect(fileName).toContain(userId);
    expect(fileName).toContain(".webp");
  });

  it("同じユーザーIDで複数回呼んでも異なるファイル名が生成されること", () => {
    // Arrange
    const userId = "user_01HXYZ";

    // Act
    const fileName1 = generateUniqueFileName(userId, "webp");
    const fileName2 = generateUniqueFileName(userId, "webp");

    // Assert
    expect(fileName1).not.toBe(fileName2);
  });

  it("avatarsディレクトリプレフィックスが含まれること", () => {
    // Arrange
    const userId = "user_01HXYZ";

    // Act
    const fileName = generateUniqueFileName(userId, "webp");

    // Assert
    expect(fileName).toMatch(/^avatars\//);
  });
});

describe("uploadAvatarToR2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("JPEGファイルをR2にアップロードできること", async () => {
      // Arrange
      mockR2Put.mockResolvedValue({ key: "avatars/user_01HXYZ_123.webp" });
      const file = createTestFile(JPEG_HEADER, "image/jpeg", "avatar.jpg");

      // Act
      const result = await uploadAvatarToR2({
        file,
        userId: "user_01HXYZ",
        config: TEST_CONFIG,
      });

      // Assert
      expect(result.avatarUrl).toMatch(/^https:\/\/cdn\.example\.com\/avatars\//);
      expect(mockR2Put).toHaveBeenCalledOnce();
    });

    it("PNGファイルをR2にアップロードできること", async () => {
      // Arrange
      mockR2Put.mockResolvedValue({ key: "avatars/user_01HXYZ_123.webp" });
      const file = createTestFile(PNG_HEADER, "image/png", "avatar.png");

      // Act
      const result = await uploadAvatarToR2({
        file,
        userId: "user_01HXYZ",
        config: TEST_CONFIG,
      });

      // Assert
      expect(result.avatarUrl).toMatch(/^https:\/\/cdn\.example\.com\/avatars\//);
      expect(mockR2Put).toHaveBeenCalledOnce();
    });

    it("WebPファイルをR2にアップロードできること", async () => {
      // Arrange
      mockR2Put.mockResolvedValue({ key: "avatars/user_01HXYZ_123.webp" });
      const file = createTestFile(WEBP_HEADER, "image/webp", "avatar.webp");

      // Act
      const result = await uploadAvatarToR2({
        file,
        userId: "user_01HXYZ",
        config: TEST_CONFIG,
      });

      // Assert
      expect(result.avatarUrl).toMatch(/^https:\/\/cdn\.example\.com\/avatars\//);
      expect(mockR2Put).toHaveBeenCalledOnce();
    });

    it("アップロード時にオリジナルファイルのContent-Typeが設定されること", async () => {
      // Arrange
      mockR2Put.mockResolvedValue({});
      const file = createTestFile(JPEG_HEADER, "image/jpeg", "avatar.jpg");

      // Act
      await uploadAvatarToR2({
        file,
        userId: "user_01HXYZ",
        config: TEST_CONFIG,
      });

      // Assert
      const callArgs = mockR2Put.mock.calls[0];
      expect(callArgs[2]).toMatchObject({
        httpMetadata: { contentType: "image/jpeg" },
      });
    });

    it("R2にアップロードされたURLが返ること", async () => {
      // Arrange
      mockR2Put.mockResolvedValue({});
      const file = createTestFile(JPEG_HEADER, "image/jpeg", "avatar.jpg");

      // Act
      const result = await uploadAvatarToR2({
        file,
        userId: "user_01HXYZ",
        config: TEST_CONFIG,
      });

      // Assert
      expect(result.avatarUrl).toMatch(/^https:\/\/cdn\.example\.com\//);
    });
  });

  describe("異常系", () => {
    it("R2アップロードが失敗した場合にエラーが発生すること", async () => {
      // Arrange
      mockR2Put.mockRejectedValue(new Error("R2 upload failed"));
      const file = createTestFile(JPEG_HEADER, "image/jpeg", "avatar.jpg");

      // Act & Assert
      await expect(
        uploadAvatarToR2({
          file,
          userId: "user_01HXYZ",
          config: TEST_CONFIG,
        }),
      ).rejects.toThrow("アバター画像のアップロードに失敗しました");
    });
  });
});
