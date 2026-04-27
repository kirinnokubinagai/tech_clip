/**
 * パスワードリセットメールテンプレート
 */

import { button, divider, muted, spacer } from "../components";
import { escapeHtml } from "../escape";
import { buildEmailLayout } from "../layout";

/** パスワードリセットメールのプリヘッダーテキスト */
const PASSWORD_RESET_PREHEADER =
  "パスワードリセット用のリンクをお送りします。24時間以内にご確認ください。";

/**
 * パスワードリセットメールの件名を返す
 *
 * @returns 件名文字列
 */
export function getPasswordResetSubject(): string {
  return "TechClip: パスワードリセットのご案内";
}

/**
 * パスワードリセットメールの HTML ボディを生成する
 *
 * @param userName - ユーザー名
 * @param resetUrl - パスワードリセット URL
 * @param appUrl - アプリのベース URL（フッターリンクに使用）
 * @returns 完全な HTML メール文字列
 */
export function buildPasswordResetHtml(userName: string, resetUrl: string, appUrl: string): string {
  const safeUserName = escapeHtml(userName);
  const safeResetUrl = escapeHtml(resetUrl);

  const content = `
<h1 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:700;color:#1c1917;line-height:1.3;">パスワードリセット</h1>
<p style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;color:#44403c;line-height:1.6;">${safeUserName} さん、</p>
<p style="margin:0 0 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;color:#44403c;line-height:1.6;">パスワードリセットのリクエストを受け付けました。下のボタンをクリックしてパスワードをリセットしてください。</p>

${spacer({ height: 8 })}
${button({ text: "パスワードをリセット", href: safeResetUrl })}
${spacer({ height: 24 })}

${muted({ text: `ボタンが機能しない場合は、以下の URL をブラウザにコピーしてください:` })}
${muted({ text: `<a href="${safeResetUrl}" style="color:#0d9488;word-break:break-all;">${safeResetUrl}</a>` })}

${spacer({ height: 24 })}
${divider()}
${spacer({ height: 20 })}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fff7ed;border-radius:6px;border:1px solid #fed7aa;">
  <tr>
    <td style="padding:16px 20px;">
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#9a3412;line-height:1.6;">
        <strong>セキュリティに関するお知らせ</strong><br />
        このリンクは <strong>24時間</strong> 有効です。リクエストした覚えがない場合は、このメールを無視してください。アカウントは引き続き保護されます。
      </p>
    </td>
  </tr>
</table>
  `.trim();

  return buildEmailLayout({
    title: getPasswordResetSubject(),
    preheader: PASSWORD_RESET_PREHEADER,
    content,
    appUrl,
  });
}
