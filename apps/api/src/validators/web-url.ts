import { z } from "zod";

/** URL最大文字数 */
const URL_MAX_LENGTH = 2048;

/**
 * HTTP(S) URL の共通スキーマ。
 * URL() だけでは javascript:, data:, file:, ftp: なども通るため、
 * 外部リンクとして扱えるスキームだけを許可する。
 */
export const HttpUrlSchema = z
  .string({ error: "URLは必須です" })
  .min(1, "URLを入力してください")
  .max(URL_MAX_LENGTH, `URLは${URL_MAX_LENGTH}文字以内で入力してください`)
  .url("URLの形式が正しくありません")
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URLはhttp://またはhttps://で始まる必要があります" },
  );
