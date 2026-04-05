import {
  generateUniqueFileName,
  type ImageUploadConfig,
  processAvatarImage,
  uploadAvatarToR2,
  validateImageFile,
} from "@api/services/imageUpload";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用のモックR2バケット */
const mockR2Put = vi.fn();
const mockR2Bucket = {
  put: mockR2Put,
};

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

/**
 * 実体のある画像ファイルを生成する
 *
 * @param format - 出力フォーマット
 * @param width - 画像幅
 * @param height - 画像高さ
 * @returns Fileオブジェクト
 */
async function createImageFile(
  format: "jpeg" | "png" | "webp",
  width = 640,
  height = 480,
): Promise<File> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .toFormat(format)
    .toBuffer();

  return new File([buffer], `avatar.${format === "jpeg" ? "jpg" : format}`, {
    type: `image/${format}`,
  });
}

describe("validateImageFile", () => {
  describe("正常系", () => {
    it("JPEGファイルを受け付けること", () => {
      // Arrange
      const file = createTestFile(INVALID_HEADER, "image/jpeg", "avatar.jpg");

      // Act
      const result = validateImageFile(file);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("PNGファイルを受け付けること", () => {
      // Arrange
      const file = createTestFile(INVALID_HEADER, "image/png", "avatar.png");

      // Act
      const result = validateImageFile(file);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("WebPファイルを受け付けること", () => {
      // Arrange
      const file = createTestFile(INVALID_HEADER, "image/webp", "avatar.webp");

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
      largeData.set(INVALID_HEADER, 0);
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

describe("processAvatarImage", () => {
  it.each([
    "jpeg",
    "png",
    "webp",
  ] as const)("実体が%sの画像を検証済み形式として保持できること", async (format) => {
    // Arrange
    const file = await createImageFile(format);

    // Act
    const result = await processAvatarImage(file);

    // Assert
    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      throw new Error("画像処理に失敗しました");
    }

    expect(result.image.contentType).toBe(format === "jpeg" ? "image/jpeg" : `image/${format}`);
    expect(result.image.extension).toBe(format === "jpeg" ? "jpg" : format);
    const output = await sharp(Buffer.from(result.image.buffer)).metadata();
    expect(output.format).toBe(format);
    expect(output.width).toBe(640);
    expect(output.height).toBe(480);
  });

  it("画像でない実体は拒否されること", async () => {
    // Arrange
    const file = new File([new TextEncoder().encode("not an image")], "avatar.jpg", {
      type: "image/jpeg",
    });

    // Act
    const result = await processAvatarImage(file);

    // Assert
    expect(result.isValid).toBe(false);
    if (result.isValid) {
      throw new Error("画像処理が拒否されませんでした");
    }
    expect(result.error).toContain("確認できませんでした");
  });

  it("寸法上限を超える画像は拒否されること", async () => {
    // Arrange
    const file = await createImageFile("png", 2049, 1);

    // Act
    const result = await processAvatarImage(file);

    // Assert
    expect(result.isValid).toBe(false);
    if (result.isValid) {
      throw new Error("画像処理が拒否されませんでした");
    }
    expect(result.error).toContain("2048px");
  });

  it("寸法がちょうど2048pxの画像は受け付けること", async () => {
    // Arrange
    const file = await createImageFile("png", 2048, 2048);

    // Act
    const result = await processAvatarImage(file);

    // Assert
    expect(result.isValid).toBe(true);
  });

  it("高さのみが寸法上限を超える画像は拒否されること", async () => {
    // Arrange
    const file = await createImageFile("png", 1, 2049);

    // Act
    const result = await processAvatarImage(file);

    // Assert
    expect(result.isValid).toBe(false);
    if (result.isValid) {
      throw new Error("画像処理が拒否されませんでした");
    }
    expect(result.error).toContain("2048px");
  });

  it("GIFヘッダーをもつファイルをimage/jpegで偽装した場合は拒否されること", async () => {
    // Arrange
    /** GIF87aマジックバイト */
    const GIF_HEADER = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x10, 0x00, 0x10, 0x00]);
    const file = new File([GIF_HEADER], "avatar.jpg", { type: "image/jpeg" });

    // Act
    const result = await processAvatarImage(file);

    // Assert
    expect(result.isValid).toBe(false);
    if (result.isValid) {
      throw new Error("MIME偽装が検出されませんでした");
    }
    expect(result.error).toBeDefined();
  });

  it("GIF89aヘッダーをもつファイルをimage/pngで偽装した場合は拒否されること", async () => {
    // Arrange
    /** GIF89aマジックバイト */
    const GIF89A_HEADER = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00, 0x10, 0x00,
    ]);
    const file = new File([GIF89A_HEADER], "avatar.png", { type: "image/png" });

    // Act
    const result = await processAvatarImage(file);

    // Assert
    expect(result.isValid).toBe(false);
    if (result.isValid) {
      throw new Error("MIME偽装が検出されませんでした");
    }
    expect(result.error).toBeDefined();
  });

  it("Content-TypeがjpegでもPNGヘッダーの実体は正常に受け付けること", async () => {
    // Arrange
    const pngFile = await createImageFile("png");
    const file = new File([await pngFile.arrayBuffer()], "avatar.jpg", {
      type: "image/jpeg",
    });

    // Act
    const result = await processAvatarImage(file);

    // Assert
    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      throw new Error("正常な画像が拒否されました");
    }
    expect(result.image.contentType).toBe("image/png");
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
    it("検証済み画像を元フォーマットでR2にアップロードできること", async () => {
      // Arrange
      mockR2Put.mockResolvedValue({ key: "avatars/user_01HXYZ_123.jpg" });
      const sourceFile = await createImageFile("jpeg");
      const processed = await processAvatarImage(sourceFile);
      if (!processed.isValid) {
        throw new Error(processed.error);
      }

      // Act
      const result = await uploadAvatarToR2({
        image: processed.image,
        userId: "user_01HXYZ",
        config: TEST_CONFIG,
      });

      // Assert
      expect(result.avatarUrl).toMatch(/^https:\/\/cdn\.example\.com\/avatars\//);
      expect(result.avatarUrl).toContain(".jpg");
      expect(mockR2Put).toHaveBeenCalledOnce();

      const callArgs = mockR2Put.mock.calls[0];
      expect(callArgs[0]).toMatch(/^avatars\/user_01HXYZ_/);
      expect(callArgs[0]).toContain(".jpg");
      expect(callArgs[2]).toMatchObject({
        httpMetadata: { contentType: "image/jpeg" },
      });

      const uploaded = await sharp(Buffer.from(callArgs[1] as Uint8Array)).metadata();
      expect(uploaded.format).toBe("jpeg");
    });
  });

  describe("異常系", () => {
    it("R2アップロードが失敗した場合にエラーが発生すること", async () => {
      // Arrange
      mockR2Put.mockRejectedValue(new Error("R2 upload failed"));
      const sourceFile = await createImageFile("jpeg");
      const processed = await processAvatarImage(sourceFile);
      if (!processed.isValid) {
        throw new Error(processed.error);
      }

      // Act & Assert
      await expect(
        uploadAvatarToR2({
          image: processed.image,
          userId: "user_01HXYZ",
          config: TEST_CONFIG,
        }),
      ).rejects.toThrow("アバター画像のアップロードに失敗しました");
    });
  });
});
