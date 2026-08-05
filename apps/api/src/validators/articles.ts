import { z } from "zod";

import { HttpUrlSchema } from "./web-url";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** 検索キーワード最大文字数 */
const QUERY_MAX_LENGTH = 200;

/**
 * 記事保存リクエストのZodスキーマ
 */
export const CreateArticleSchema = z.object({
  url: HttpUrlSchema,
});

/**
 * 記事更新リクエストのZodスキーマ
 */
export const UpdateArticleSchema = z
  .object({
    isRead: z.boolean({ error: "isReadはブール値で指定してください" }).optional(),
    isFavorite: z.boolean({ error: "isFavoriteはブール値で指定してください" }).optional(),
    isPublic: z.boolean({ error: "isPublicはブール値で指定してください" }).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.isRead !== undefined || data.isFavorite !== undefined || data.isPublic !== undefined,
    {
      message: "更新するフィールドを1つ以上指定してください",
    },
  );

/**
 * 記事検索クエリパラメータのZodスキーマ
 */
export const SearchArticlesSchema = z.object({
  q: z
    .string({ error: "検索キーワードは必須です" })
    .trim()
    .min(1, "検索キーワードを入力してください")
    .max(QUERY_MAX_LENGTH, `検索キーワードは${QUERY_MAX_LENGTH}文字以内で入力してください`),
  limit: z
    .union([
      z.number(),
      z.string().trim().regex(/^\d+$/, "limitは整数で指定してください").transform(Number),
    ])
    .pipe(
      z
        .number()
        .int("limitは整数で指定してください")
        .min(MIN_LIMIT, `limitは${MIN_LIMIT}以上で指定してください`)
        .max(MAX_LIMIT, `limitは${MAX_LIMIT}以下で指定してください`),
    )
    .default(DEFAULT_LIMIT),
  cursor: z.string().optional(),
});

/** CreateArticleSchemaの型 */
export type CreateArticleInput = z.infer<typeof CreateArticleSchema>;

/** UpdateArticleSchemaの型 */
export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>;

/** SearchArticlesSchemaの型 */
export type SearchArticlesInput = z.infer<typeof SearchArticlesSchema>;
