import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import WebView from "react-native-webview";

/** document.body.innerText を抽出する injected JS */
const EXTRACT_TEXT_JS = `
(function() {
  try {
    var title = document.title || "";
    // 記事本文を優先して取得: <article> > <main> > role=main > body
    var articleEl = document.querySelector("article")
      || document.querySelector("main")
      || document.querySelector('[role="main"]')
      || document.body;
    // 本文に混ざりやすいナビ・広告・フッター・スクリプトなどを除外してからテキスト化
    var clone = articleEl ? articleEl.cloneNode(true) : null;
    if (clone) {
      var noise = clone.querySelectorAll('nav, footer, aside, script, style, noscript, iframe, [role="navigation"], [role="complementary"], [role="banner"], [aria-hidden="true"], [class*="ad"], [class*="sidebar"], [id*="ad-"]');
      for (var i = 0; i < noise.length; i++) {
        noise[i].parentNode && noise[i].parentNode.removeChild(noise[i]);
      }
    }
    var body = clone ? (clone.innerText || clone.textContent || "") : "";
    var text = body.replace(/\\s+/g, " ").trim();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "extracted_text",
      title: title,
      text: text.slice(0, 50000),
      url: location.href,
    }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "extract_error",
      message: String(e && e.message ? e.message : e),
    }));
  }
  true;
})();
`;

/** document.documentElement.outerHTML を snapshot する injected JS */
const SNAPSHOT_HTML_JS = `
(function() {
  try {
    var html = document.documentElement ? document.documentElement.outerHTML : "";
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "snapshot_html",
      html: html.slice(0, 500000),
      url: location.href,
    }));
  } catch (e) {}
  true;
})();
`;

export type ExtractedPayload = {
  title: string;
  text: string;
  url: string;
};

export type ArticleWebViewHandle = {
  /** 本文テキストを抽出する */
  extractText: () => void;
  /** 完全な HTML スナップショットを要求する */
  snapshotHtml: () => void;
};

type ArticleWebViewProps = {
  url: string;
  onExtract?: (payload: ExtractedPayload) => void;
  onSnapshot?: (html: string, url: string) => void;
  /** オフライン時に cached HTML を表示する場合に指定 */
  cachedHtml?: string | null;
};

/**
 * 記事を WebView で表示するコンポーネント
 *
 * - extractText() で document.innerText を抽出し onExtract に渡す
 * - snapshotHtml() で outerHTML を取得し onSnapshot に渡す
 * - cachedHtml が指定されるとオフラインキャッシュから表示
 */
export const ArticleWebView = forwardRef<ArticleWebViewHandle, ArticleWebViewProps>(
  function ArticleWebView({ url, onExtract, onSnapshot, cachedHtml }, ref) {
    const webviewRef = useRef<WebView | null>(null);
    const hasExtractedRef = useRef(false);
    const [isLoading, setIsLoading] = useState(true);

    const extractText = useCallback(() => {
      webviewRef.current?.injectJavaScript(EXTRACT_TEXT_JS);
    }, []);

    const snapshotHtml = useCallback(() => {
      webviewRef.current?.injectJavaScript(SNAPSHOT_HTML_JS);
    }, []);

    useImperativeHandle(ref, () => ({ extractText, snapshotHtml }), [extractText, snapshotHtml]);

    const onMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const payload = JSON.parse(event.nativeEvent.data) as {
            type?: string;
            title?: string;
            text?: string;
            html?: string;
            url?: string;
          };
          if (payload.type === "extracted_text" && typeof payload.text === "string") {
            onExtract?.({
              title: payload.title ?? "",
              text: payload.text,
              url: payload.url ?? url,
            });
          } else if (payload.type === "snapshot_html" && typeof payload.html === "string") {
            onSnapshot?.(payload.html, payload.url ?? url);
          }
        } catch {
          // malformed message - ignore
        }
      },
      [onExtract, onSnapshot, url],
    );

    const source = cachedHtml ? { html: cachedHtml, baseUrl: url } : { uri: url };

    return (
      <View style={styles.container}>
        <WebView
          ref={webviewRef}
          source={source}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => {
            setIsLoading(false);
            // 初回ロード完了時のみ自動抽出（SPA / クライアントナビで重複発火を防ぐ）
            if (!hasExtractedRef.current) {
              hasExtractedRef.current = true;
              extractText();
              snapshotHtml();
            }
          }}
          onMessage={onMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          // セキュリティ: 同一 origin 外の iframe 遷移を防ぐ
          originWhitelist={["https://*", "http://*"]}
          setSupportMultipleWindows={false}
          mixedContentMode="never"
          testID="article-webview"
          style={styles.webview}
        />
        {isLoading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" />
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
});
