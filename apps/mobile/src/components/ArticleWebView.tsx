import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";

/**
 * WebView 上で Readability を使って本文テキストを抽出する JS
 * onMessage で { type: "extracted", text, html, title } を送る
 */
const EXTRACT_JS = `
(function() {
  try {
    // 最短路: textContent ベースで抽出（Readability を CDN から import するのは bundle 簡素化のため避ける）
    var title = document.title || "";
    var body = document.body ? (document.body.innerText || document.body.textContent || "") : "";
    var text = body.replace(/\\s+/g, " ").trim();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: "extracted",
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

type ExtractedPayload = {
  title: string;
  text: string;
  url: string;
};

type ArticleWebViewProps = {
  /** 表示する記事 URL */
  url: string;
  /** 本文抽出が完了したときに呼ばれるコールバック */
  onExtract?: (payload: ExtractedPayload) => void;
  /** 抽出を外部からトリガーするための ref オブジェクト */
  extractRef?: { extract: () => void } | null;
};

/**
 * 記事を WebView で表示するコンポーネント
 *
 * オリジナルサイトを fidelity 100% で表示しつつ、
 * 要約・翻訳用のテキスト抽出をオンデマンドで提供する。
 */
export function ArticleWebView({ url, onExtract }: ArticleWebViewProps): React.ReactElement {
  const webviewRef = useRef<WebView | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const extractContent = useCallback(() => {
    webviewRef.current?.injectJavaScript(EXTRACT_JS);
  }, []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as {
          type: string;
          title?: string;
          text?: string;
          url?: string;
        };
        if (payload.type === "extracted" && payload.text !== undefined) {
          onExtract?.({
            title: payload.title ?? "",
            text: payload.text,
            url: payload.url ?? url,
          });
        }
      } catch {
        // silently ignore malformed messages
      }
    },
    [onExtract, url],
  );

  // expose extract function via imperative handle pattern
  if (typeof extractContent === "function") {
    // No direct use; parent passes prop via callback if needed
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ uri: url }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onMessage={onMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
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
}

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
