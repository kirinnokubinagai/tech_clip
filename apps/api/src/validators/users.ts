import { z } from "zod";

/** 名前最大文字数 */
const NAME_MAX_LENGTH = 100;

/** ユーザー名最大文字数 */
const USERNAME_MAX_LENGTH = 30;

/** 自己紹介最大文字数 */
const BIO_MAX_LENGTH = 500;

/** URL最大文字数 */
const URL_MAX_LENGTH = 2048;

/** GitHubユーザー名最大文字数 */
const GITHUB_USERNAME_MAX_LENGTH = 39;

/** Twitterユーザー名最大文字数 */
const TWITTER_USERNAME_MAX_LENGTH = 15;

/** ユーザー名の正規表現（半角英数字とアンダースコア、ハイフンのみ） */
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * プロフィール更新リクエストのZodスキーマ
 */
export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .max(NAME_MAX_LENGTH, `名前は${NAME_MAX_LENGTH}文字以内で入力してください`)
    .trim()
    .nullable()
    .optional(),
  username: z
    .string()
    .max(USERNAME_MAX_LENGTH, `ユーザー名は${USERNAME_MAX_LENGTH}文字以内で入力してください`)
    .regex(USERNAME_REGEX, "ユーザー名は半角英数字、アンダースコア、ハイフンのみ使用できます")
    .nullable()
    .optional(),
  bio: z
    .string()
    .max(BIO_MAX_LENGTH, `自己紹介は${BIO_MAX_LENGTH}文字以内で入力してください`)
    .nullable()
    .optional(),
  websiteUrl: z
    .string()
    .max(URL_MAX_LENGTH, `URLは${URL_MAX_LENGTH}文字以内で入力してください`)
    .url("URLの形式が正しくありません")
    .nullable()
    .optional(),
  githubUsername: z
    .string()
    .max(
      GITHUB_USERNAME_MAX_LENGTH,
      `GitHubユーザー名は${GITHUB_USERNAME_MAX_LENGTH}文字以内で入力してください`,
    )
    .nullable()
    .optional(),
  twitterUsername: z
    .string()
    .max(
      TWITTER_USERNAME_MAX_LENGTH,
      `Twitterユーザー名は${TWITTER_USERNAME_MAX_LENGTH}文字以内で入力してください`,
    )
    .nullable()
    .optional(),
  isProfilePublic: z.boolean().optional(),
  preferredLanguage: z.string().optional(),
});

/**
 * アバターアップロードリクエストのZodスキーマ
 */
export const UploadAvatarSchema = z.object({
  avatar: z.instanceof(File, { message: "avatarフィールドにファイルを指定してください" }),
});

/** UpdateProfileSchemaの型 */
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

/** UploadAvatarSchemaの型 */
export type UploadAvatarInput = z.infer<typeof UploadAvatarSchema>;
