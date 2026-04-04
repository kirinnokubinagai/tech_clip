import sharp from "sharp";

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
  contentType: "image/webp";
  extension: "webp";
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

/** アバター画像の最大ファイルサイズ（5MB） */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** アバター画像の最大寸法 */
const MAX_IMAGE_DIMENSION = 4096;

/** アバター画像の出力寸法上限 */
const MAX_OUTPUT_DIMENSION = 512;

/** 出力WebPの品質 */
const WEBP_QUALITY = 82;

/** アバター保存ディレクトリ */
const AVATARS_DIR = "avatars";

/** 画像の内容を検査できなかった場合のメッセージ */
const IMAGE_CONTENT_ERROR_MESSAGE = "画像の内容を確認できませんでした";

/** 画像の寸法上限エラーメッセージ */
const IMAGE_DIMENSION_ERROR_MESSAGE = `画像は${MAX_IMAGE_DIMENSION}px以下でアップロードしてください`;

/** 画像の再エンコード失敗メッセージ */
const IMAGE_REENCODE_ERROR_MESSAGE = "画像の再エンコードに失敗しました";

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
 * 画像の実体を検査し、アバター用のWebPに正規化する
 *
 * @param file - 検査対象の画像ファイル
 * @returns 画像処理結果
 */
export async function processAvatarImage(file: File): Promise<ProcessAvatarImageResult> {
  const input = new Uint8Array(await file.arrayBuffer());

  const metadata = await sharp(input)
    .metadata()
    .catch(() => undefined);

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

  try {
    const output = await sharp(input)
      .rotate()
      .resize({
        width: MAX_OUTPUT_DIMENSION,
        height: MAX_OUTPUT_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    return {
      isValid: true,
      image: {
        buffer: Uint8Array.from(output),
        contentType: "image/webp",
        extension: "webp",
      },
    };
  } catch {
    return { isValid: false, error: IMAGE_REENCODE_ERROR_MESSAGE };
  }
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
 * 画像は事前に `processAvatarImage` で WebP に正規化されていることを前提とする。
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
