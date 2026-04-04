/** R2バケットへのアップロード設定 */
export type ImageUploadConfig = {
  r2Bucket: R2Bucket;
  r2PublicUrl: string;
};

/** ファイルバリデーション結果 */
export type ValidationResult = {
  isValid: boolean;
  error?: string;
};

/** アバターアップロード結果 */
export type AvatarUploadResult = {
  avatarUrl: string;
};

/** 正規化済みアバター画像 */
export type PreparedAvatarImage = {
  buffer: Uint8Array;
  contentType: AllowedMimeType;
  extension: AllowedImageExtension;
};

/** 画像処理結果 */
export type ProcessAvatarImageResult =
  | {
      isValid: true;
      image: PreparedAvatarImage;
    }
  | {
      isValid: false;
      error: string;
    };

/** uploadAvatarToR2のパラメータ */
type UploadAvatarParams = {
  image: PreparedAvatarImage;
  userId: string;
  config: ImageUploadConfig;
};

/** 許可するMIMEタイプ */
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** 許可する実体フォーマット */
const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp"] as const);

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
type AllowedImageFormat = "jpeg" | "png" | "webp";
type AllowedImageExtension = "jpg" | "png" | "webp";

/** アバター画像の最大ファイルサイズ（5MB） */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** アバター画像の最大寸法 */
const MAX_IMAGE_DIMENSION = 4096;

/** アバター保存ディレクトリ */
const AVATARS_DIR = "avatars";

/** 画像の内容を検査できなかった場合のメッセージ */
const IMAGE_CONTENT_ERROR_MESSAGE = "画像の内容を確認できませんでした";

/** 画像の寸法上限エラーメッセージ */
const IMAGE_DIMENSION_ERROR_MESSAGE = `画像は${MAX_IMAGE_DIMENSION}px以下でアップロードしてください`;

type DetectedImageMetadata = {
  format: AllowedImageFormat;
  width: number;
  height: number;
  contentType: AllowedMimeType;
  extension: AllowedImageExtension;
};

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 30 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function detectPng(bytes: Uint8Array): DetectedImageMetadata | null {
  if (!isPng(bytes)) {
    return null;
  }

  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);

  return {
    format: "png",
    width,
    height,
    contentType: "image/png",
    extension: "png",
  };
}

function detectJpeg(bytes: Uint8Array): DetectedImageMetadata | null {
  if (!isJpeg(bytes)) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];

    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    if (offset + 4 > bytes.length) {
      return null;
    }

    const segmentLength = readUint16BE(bytes, offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) {
      return null;
    }

    const isStartOfFrame =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf;

    if (isStartOfFrame) {
      const height = readUint16BE(bytes, offset + 5);
      const width = readUint16BE(bytes, offset + 7);

      return {
        format: "jpeg",
        width,
        height,
        contentType: "image/jpeg",
        extension: "jpg",
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function detectWebp(bytes: Uint8Array): DetectedImageMetadata | null {
  if (!isWebp(bytes)) {
    return null;
  }

  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (chunkType === "VP8X" && bytes.length >= 30) {
    const width = 1 + readUint24LE(bytes, 24);
    const height = 1 + readUint24LE(bytes, 27);

    return {
      format: "webp",
      width,
      height,
      contentType: "image/webp",
      extension: "webp",
    };
  }

  if (chunkType === "VP8 " && bytes.length >= 30) {
    const width = readUint16BE(Uint8Array.from([bytes[27], bytes[26]]), 0) & 0x3fff;
    const height = readUint16BE(Uint8Array.from([bytes[29], bytes[28]]), 0) & 0x3fff;

    return {
      format: "webp",
      width,
      height,
      contentType: "image/webp",
      extension: "webp",
    };
  }

  if (chunkType === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const width = 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]);
    const height = 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | (bytes[22] >> 6));

    return {
      format: "webp",
      width,
      height,
      contentType: "image/webp",
      extension: "webp",
    };
  }

  return null;
}

/**
 * 画像バイト列からフォーマットと寸法を抽出する
 *
 * @param bytes - 画像ファイルのバイト列
 * @returns 検出された画像メタデータ。対応外の場合はnull
 */
function detectImageMetadata(bytes: Uint8Array): DetectedImageMetadata | null {
  return detectPng(bytes) ?? detectJpeg(bytes) ?? detectWebp(bytes);
}

/**
 * アップロードされたファイルを検証する
 *
 * @param file - 検証対象のファイル
 * @returns バリデーション結果
 */
export function validateImageFile(file: File): ValidationResult {
  if (file.size === 0) {
    return { isValid: false, error: "ファイルが空です" };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { isValid: false, error: "ファイルサイズは5MB以下にしてください" };
  }

  const isAllowed = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
  if (!isAllowed) {
    return {
      isValid: false,
      error: "jpg/png/webpのみアップロードできます",
    };
  }

  return { isValid: true };
}

/**
 * 画像の実体を検査し、検出したフォーマット情報を付与して返す
 *
 * @param file - 検査対象の画像ファイル
 * @returns 画像処理結果
 */
export async function processAvatarImage(file: File): Promise<ProcessAvatarImageResult> {
  const input = new Uint8Array(await file.arrayBuffer());
  const metadata = detectImageMetadata(input);

  if (!metadata?.width || !metadata?.height || !metadata?.format) {
    return { isValid: false, error: IMAGE_CONTENT_ERROR_MESSAGE };
  }

  if (!ALLOWED_IMAGE_FORMATS.has(metadata.format as "jpeg" | "png" | "webp")) {
    return {
      isValid: false,
      error: IMAGE_CONTENT_ERROR_MESSAGE,
    };
  }

  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
    return { isValid: false, error: IMAGE_DIMENSION_ERROR_MESSAGE };
  }

  return {
    isValid: true,
    image: {
      buffer: input,
      contentType: metadata.contentType,
      extension: metadata.extension,
    },
  };
}

/**
 * ユニークなファイル名を生成する
 *
 * @param userId - ユーザーID
 * @param extension - ファイル拡張子（ドットなし）
 * @returns ユニークなファイルパス
 */
export function generateUniqueFileName(userId: string, extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${AVATARS_DIR}/${userId}_${timestamp}_${random}.${extension}`;
}

/**
 * アバター画像をCloudflare R2にアップロードする
 *
 * 画像は事前に `processAvatarImage` で実体検証済みであることを前提とする。
 *
 * @param params - 画像、ユーザーID、R2設定
 * @returns アップロードされた画像のURL
 * @throws Error - アップロードに失敗した場合
 */
export async function uploadAvatarToR2(params: UploadAvatarParams): Promise<AvatarUploadResult> {
  const { image, userId, config } = params;

  const fileName = generateUniqueFileName(userId, image.extension);

  try {
    await config.r2Bucket.put(fileName, image.buffer, {
      httpMetadata: { contentType: image.contentType },
    });
  } catch {
    throw new Error("アバター画像のアップロードに失敗しました");
  }

  const avatarUrl = `${config.r2PublicUrl}/${fileName}`;
  return { avatarUrl };
}
