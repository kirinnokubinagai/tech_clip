/**
 * メールアドレス認証メールテンプレート
 */

import { button, divider, muted, spacer } from "../components";
import { escapeHtml } from "../escape";
import { buildEmailLayout } from "../layout";

/** メール認証メールのプリヘッダーテキスト */
const EMAIL_VERIFICATION_PREHEADER =
  "アカウント作成ありがとうございます。認証を完了してすべての機能をご利用ください。";

/**
 * メールアドレス認証メールの件名を返す
 *
 * @returns 件名文字列
 */
export function getEmailVerificationSubject(): string {
  return "TechClip へようこそ！メールアドレスを認証してください";
}

/**
 * メール認証メールの HTML ボディを生成する
 *
 * @param userName - ユーザー名
 * @param verifyUrl - メール認証 URL
 * @param appUrl - アプリのベース URL（フッターリンクに使用）
 * @returns 完全な HTML メール文字列
 */
export function buildEmailVerificationHtml(
  userName: string,
  verifyUrl: string,
  appUrl: string,
): string {
  const safeUserName = escapeHtml(userName);
  const safeVerifyUrl = escapeHtml(verifyUrl);

  const content = `
<h1 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:700;color:#1c1917;line-height:1.3;">${safeUserName} さん、TechClip へようこそ！</h1>
<p style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;color:#44403c;line-height:1.6;">メールアドレス認証を完了して、すべての機能をご利用ください。</p>

${spacer({ height: 8 })}
${button({ text: "メールアドレスを認証", href: safeVerifyUrl })}
${spacer({ height: 24 })}

${muted({ text: `ボタンが機能しない場合は、以下の URL をブラウザにコピーしてください:` })}
${muted({ text: `<a href="${safeVerifyUrl}" style="color:#0d9488;word-break:break-all;">${safeVerifyUrl}</a>` })}

${spacer({ height: 24 })}
${divider()}
${spacer({ height: 20 })}

<p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:600;color:#1c1917;">TechClip でできること</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:10px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="32" valign="top" style="padding-right:12px;">
            <div style="width:28px;height:28px;background-color:#ccfbf1;border-radius:6px;text-align:center;line-height:28px;font-size:14px;color:#0f766e;font-weight:700;">1</div>
          </td>
          <td valign="top">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#44403c;line-height:1.6;"><strong style="color:#1c1917;">技術記事をワンタップで保存</strong><br />気になった記事を即座にクリップ</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="32" valign="top" style="padding-right:12px;">
            <div style="width:28px;height:28px;background-color:#ccfbf1;border-radius:6px;text-align:center;line-height:28px;font-size:14px;color:#0f766e;font-weight:700;">2</div>
          </td>
          <td valign="top">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#44403c;line-height:1.6;"><strong style="color:#1c1917;">AI で要約・翻訳</strong><br />長い記事も素早くキャッチアップ</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:10px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="32" valign="top" style="padding-right:12px;">
            <div style="width:28px;height:28px;background-color:#ccfbf1;border-radius:6px;text-align:center;line-height:28px;font-size:14px;color:#0f766e;font-weight:700;">3</div>
          </td>
          <td valign="top">
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#44403c;line-height:1.6;"><strong style="color:#1c1917;">オフラインで読める</strong><br />通信環境を問わず記事を閲覧</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

${spacer({ height: 16 })}

${muted({ text: "このリンクは 24時間 有効です。" })}
  `.trim();

  return buildEmailLayout({
    title: getEmailVerificationSubject(),
    preheader: EMAIL_VERIFICATION_PREHEADER,
    content,
    appUrl,
  });
}
