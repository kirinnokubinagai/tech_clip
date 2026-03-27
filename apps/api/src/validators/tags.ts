import { z } from "zod";

/** タグ名最大文字数 */
const TAG_NAME_MAX_LENGTH = 50;

/**
 * タグ作成リクエストのZodスキーマ
 */
export const CreateTagSchema = z.object({
  name: z
    .string({ error: "タグ名は必須です" })
    .min(1, "タグ名を入力してください")
    .max(TAG_NAME_MAX_LENGTH, `タグ名は${TAG_NAME_MAX_LENGTH}文字以内で入力してください`)
    .trim(),
});

/**
 * 記事タグ更新リクエストのZodスキーマ
 */
export const UpdateArticleTagsSchema = z.object({
  tagIds: z.array(z.string(), { error: "tagIdsは配列で指定してください" }),
});

/** CreateTagSchemaの型 */
export type CreateTagInput = z.infer<typeof CreateTagSchema>;

/** UpdateArticleTagsSchemaの型 */
export type UpdateArticleTagsInput = z.infer<typeof UpdateArticleTagsSchema>;
