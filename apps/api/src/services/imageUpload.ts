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

/** uploadAvatarToR2のパラメータ */
type UploadAvatarParams = {
  file: File;
  userId: string;
  config: ImageUploadConfig;
};

/** 許可するMIMEタイプ */
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** アバター画像の最大ファイルサイズ（5MB） */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** アバター保存ディレクトリ */
const AVATARS_DIR = "avatars";

/** アップロード画像のContent-Type */
const UPLOAD_CONTENT_TYPE = "image/webp";

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
 * @param params - ファイル、ユーザーID、R2設定
 * @returns アップロードされた画像のURL
 * @throws Error - アップロードに失敗した場合
 */
export async function uploadAvatarToR2(params: UploadAvatarParams): Promise<AvatarUploadResult> {
  const { file, userId, config } = params;

  const fileName = generateUniqueFileName(userId, "webp");
  const arrayBuffer = await file.arrayBuffer();

  try {
    await config.r2Bucket.put(fileName, arrayBuffer, {
      httpMetadata: { contentType: UPLOAD_CONTENT_TYPE },
    });
  } catch {
    throw new Error("アバター画像のアップロードに失敗しました");
  }

  const avatarUrl = `${config.r2PublicUrl}/${fileName}`;
  return { avatarUrl };
}
