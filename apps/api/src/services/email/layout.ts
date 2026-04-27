/**
 * メールテンプレート共通ベースレイアウト
 *
 * 完全な HTML ドキュメントを生成する。
 * Outlook 2007+ 互換の table ベースレイアウト。
 * ダークモード対応（Apple Mail 等向け）。
 */

/** 外側テーブル背景カラー */
const OUTER_BG_COLOR = "#f5f5f4";

/** ヘッダー背景カラー */
const HEADER_BG_COLOR = "#0f766e";

/** フッターテキストカラー */
const FOOTER_TEXT_COLOR = "#78716c";

/** サービス名 */
const SERVICE_NAME = "TechClip";

/**
 * TechClip ロゴ（SVG data URI）
 * テキストベースのブランドロゴ
 */
const LOGO_SVG =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjZmZmZmZmIi8+PHBhdGggZD0iTTggMTBoMTBNOCAxNmgxNk04IDIyaDEyIiBzdHJva2U9IiMxNGI4YTYiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=";

/**
 * メールの共通フッター HTML を生成する
 *
 * @param appUrl - アプリのベース URL（通知設定リンクに使用）
 * @returns フッター HTML 文字列
 */
function buildFooter(appUrl: string): string {
  const currentYear = new Date().getFullYear();
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:24px 40px;text-align:center;">
      <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;color:${FOOTER_TEXT_COLOR};line-height:1.6;">
        このメールは送信専用です。返信はお受けできません。
      </p>
      <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;color:${FOOTER_TEXT_COLOR};line-height:1.6;">
        <a href="${appUrl}/settings/notifications" style="color:#0d9488;text-decoration:underline;">メール受信設定を変更する</a>
      </p>
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#a8a29e;line-height:1.6;">
        &copy; ${currentYear} ${SERVICE_NAME}. All rights reserved.
      </p>
    </td>
  </tr>
</table>`.trim();
}

/**
 * メールの共通ヘッダー（ブランドヘッダー）HTML を生成する
 *
 * @returns ヘッダー HTML 文字列
 */
function buildHeader(): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:24px 40px;background-color:${HEADER_BG_COLOR};border-radius:8px 8px 0 0;text-align:center;">
      <img src="${LOGO_SVG}" width="32" height="32" alt="${SERVICE_NAME} ロゴ" style="display:inline-block;vertical-align:middle;margin-right:10px;border:0;" />
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;vertical-align:middle;">${SERVICE_NAME}</span>
    </td>
  </tr>
</table>`.trim();
}

/** ベースレイアウトに渡すパラメータ */
export type LayoutParams = {
  /** ページタイトル（head の title 要素） */
  title: string;
  /** プリヘッダーテキスト（受信箱プレビュー。40〜90 字推奨） */
  preheader: string;
  /** メイン本文 HTML */
  content: string;
  /** アプリのベース URL */
  appUrl: string;
};

/**
 * 完全な HTML メールドキュメントを生成する
 *
 * @param params - レイアウトパラメータ
 * @returns 完全な HTML 文字列
 */
export function buildEmailLayout(params: LayoutParams): string {
  const { title, preheader, content, appUrl } = params;
  const header = buildHeader();
  const footer = buildFooter(appUrl);

  return `<!DOCTYPE html>
<html lang="ja" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: ${OUTER_BG_COLOR};
    }
    table {
      border-spacing: 0;
    }
    td {
      padding: 0;
    }
    img {
      border: 0;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content-padding {
        padding: 24px 20px !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #1c1917 !important;
      }
      .email-body {
        background-color: #292524 !important;
      }
      .email-text {
        color: #f5f5f4 !important;
      }
      .email-muted {
        color: #a8a29e !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${OUTER_BG_COLOR};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- プリヘッダー（受信箱プレビューテキスト） -->
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;mso-hide:all;font-size:1px;line-height:1px;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <!-- 外側テーブル（全幅背景） -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${OUTER_BG_COLOR}">
    <tr>
      <td style="padding:32px 16px;">
        <!-- 内側テーブル（コンテンツ幅 600px） -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center" class="email-container" style="max-width:600px;margin:0 auto;">
          <tr>
            <td class="email-body" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <!-- ブランドヘッダー -->
              ${header}
              <!-- メインコンテンツ -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="content-padding" style="padding:32px 40px;">
                    ${content}
                  </td>
                </tr>
              </table>
              <!-- フッター -->
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
