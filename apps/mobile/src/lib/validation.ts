/** メールアドレスの簡易バリデーション正規表現（空白なし・@あり・ドメインにドットあり） */
export const EMAIL_SIMPLE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 認証画面で使うパスワード最小文字数 */
export const PASSWORD_MIN_LENGTH = 8;
