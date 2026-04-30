/**
 * メールテンプレート共通コンポーネント
 *
 * Outlook 互換の table レイアウトベースで実装する。
 * flexbox / grid / CSS カスタムプロパティは使用禁止。
 * 主要スタイルはすべて inline で記述する。
 */

/** プライマリカラー */
const PRIMARY_COLOR = "#14b8a6";

/** プライマリカラー（ホバー用・濃い） */
const PRIMARY_DARK_COLOR = "#0d9488";

/** ボーダーカラー */
const BORDER_COLOR = "#e7e5e4";

/** テキストカラー（薄） */
const MUTED_COLOR = "#78716c";

/** カード背景カラー */
const CARD_BG_COLOR = "#ffffff";

/**
 * CTA ボタンを生成する（Bulletproof button: Outlook VML fallback 付き）
 *
 * @param text - ボタンテキスト
 * @param href - リンク先 URL
 * @returns HTML 文字列
 */
export function button({ text, href }: { text: string; href: string }): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr>
    <td align="center" style="border-radius:8px;background-color:${PRIMARY_COLOR};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%" stroke="f" fillcolor="${PRIMARY_COLOR}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;font-weight:600;">${text}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${href}" target="_blank"
         style="display:inline-block;padding:14px 28px;background-color:${PRIMARY_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.4;mso-hide:all;">${text}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

/**
 * カードブロックを生成する
 *
 * @param title - カードタイトル
 * @param body - カード本文 HTML（既にエスケープ済みの文字列）
 * @returns HTML 文字列
 */
export function card({ title, body }: { title: string; body: string }): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px;">
  <tr>
    <td style="padding:16px 20px;background-color:${CARD_BG_COLOR};border:1px solid ${BORDER_COLOR};border-radius:8px;border-left:4px solid ${PRIMARY_COLOR};">
      <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:600;color:#1c1917;line-height:1.4;">${title}</p>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#44403c;line-height:1.6;">${body}</p>
    </td>
  </tr>
</table>`.trim();
}

/**
 * 水平区切り線を生成する
 *
 * @returns HTML 文字列
 */
export function divider(): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td height="1" bgcolor="${BORDER_COLOR}" style="font-size:1px;line-height:1px;">&nbsp;</td>
  </tr>
</table>`.trim();
}

/**
 * グレー補足テキストを生成する
 *
 * @param text - 表示テキスト（既にエスケープ済み）
 * @returns HTML 文字列
 */
export function muted({ text }: { text: string }): string {
  return `<p style="margin:8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;color:${MUTED_COLOR};line-height:1.6;">${text}</p>`;
}

/**
 * 縦方向のスペーサーを生成する
 *
 * @param height - 高さ (px)
 * @returns HTML 文字列
 */
export function spacer({ height }: { height: number }): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td height="${height}" style="font-size:1px;line-height:1px;">&nbsp;</td>
  </tr>
</table>`.trim();
}

export { BORDER_COLOR, MUTED_COLOR, PRIMARY_COLOR, PRIMARY_DARK_COLOR };
