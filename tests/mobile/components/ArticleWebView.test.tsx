import { act, render } from "@testing-library/react-native";

jest.mock("@/lib/constants", () => ({
  WEBVIEW_ORIGIN_WHITELIST: ["https://*", "http://*"],
}));

import { ArticleWebView } from "@mobile/components/ArticleWebView";

/**
 * react-native-webview モックから capturedProps を取得する
 * moduleNameMapper で __mocks__ ファイルが使われているため、
 * require した WebView に capturedProps が付属している
 */
function getWebViewCallbacks(): {
  onMessage?: (e: { nativeEvent: { data: string } }) => void;
  onLoadEnd?: () => void;
  onLoadStart?: () => void;
} {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const webviewModule = require("react-native-webview");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return webviewModule.capturedProps ?? {};
}

/** テスト用 URL */
const TEST_URL = "https://example.com/article";

describe("ArticleWebView", () => {
  beforeEach(() => {
    const callbacks = getWebViewCallbacks();
    callbacks.onMessage = undefined;
    callbacks.onLoadEnd = undefined;
    callbacks.onLoadStart = undefined;
  });

  describe("レンダリング", () => {
    it("testID='article-webview'が設定されていること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ArticleWebView url={TEST_URL} />);

      // Assert
      expect(getByTestId("article-webview")).toBeDefined();
    });

    it("初期状態でローディングインジケーターが表示されること", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(<ArticleWebView url={TEST_URL} />);

      // Assert
      expect(queryByTestId("article-webview-loading")).not.toBeNull();
    });

    it("onLoadEnd後にローディングインジケーターが非表示になること", async () => {
      // Arrange
      const { queryByTestId } = await render(<ArticleWebView url={TEST_URL} />);

      // Act
      await act(async () => {
        getWebViewCallbacks().onLoadEnd?.();
      });

      // Assert
      expect(queryByTestId("article-webview-loading")).toBeNull();
    });

    it("onLoadStart後にローディングインジケーターが再表示されること", async () => {
      // Arrange
      const { queryByTestId } = await render(<ArticleWebView url={TEST_URL} />);

      // Act: まず onLoadEnd でローディングを消す
      await act(async () => {
        getWebViewCallbacks().onLoadEnd?.();
      });

      // Act: 次に onLoadStart でローディングを再表示
      await act(async () => {
        getWebViewCallbacks().onLoadStart?.();
      });

      // Assert
      expect(queryByTestId("article-webview-loading")).not.toBeNull();
    });
  });

  describe("URI ソース", () => {
    it("cachedHtmlが未指定のとき WebView がマウントされること", async () => {
      // Arrange & Act
      await render(<ArticleWebView url={TEST_URL} />);

      // Assert: onMessage が設定されていれば WebView がマウントされている
      expect(getWebViewCallbacks().onMessage).toBeDefined();
    });

    it("cachedHtmlが指定されたとき WebView がマウントされること", async () => {
      // Arrange
      const cachedHtml = "<html><body>cached</body></html>";

      // Act
      await render(<ArticleWebView url={TEST_URL} cachedHtml={cachedHtml} />);

      // Assert
      expect(getWebViewCallbacks().onMessage).toBeDefined();
    });
  });

  describe("メッセージハンドリング", () => {
    it("extracted_text メッセージで onExtract が呼ばれること", async () => {
      // Arrange
      const onExtract = jest.fn();
      await render(<ArticleWebView url={TEST_URL} onExtract={onExtract} />);
      const onMessage = getWebViewCallbacks().onMessage;

      // Act
      await act(async () => {
        onMessage?.({
          nativeEvent: {
            data: JSON.stringify({
              type: "extracted_text",
              title: "テスト記事",
              text: "記事本文です",
              url: TEST_URL,
            }),
          },
        });
      });

      // Assert
      expect(onExtract).toHaveBeenCalledTimes(1);
      expect(onExtract).toHaveBeenCalledWith({
        title: "テスト記事",
        text: "記事本文です",
        url: TEST_URL,
      });
    });

    it("snapshot_html メッセージで onSnapshot が呼ばれること", async () => {
      // Arrange
      const onSnapshot = jest.fn();
      await render(<ArticleWebView url={TEST_URL} onSnapshot={onSnapshot} />);
      const onMessage = getWebViewCallbacks().onMessage;

      // Act
      await act(async () => {
        onMessage?.({
          nativeEvent: {
            data: JSON.stringify({
              type: "snapshot_html",
              html: "<html><body>content</body></html>",
              url: TEST_URL,
            }),
          },
        });
      });

      // Assert
      expect(onSnapshot).toHaveBeenCalledTimes(1);
      expect(onSnapshot).toHaveBeenCalledWith("<html><body>content</body></html>", TEST_URL);
    });

    it("不正な JSON メッセージでは onExtract が呼ばれないこと", async () => {
      // Arrange
      const onExtract = jest.fn();
      await render(<ArticleWebView url={TEST_URL} onExtract={onExtract} />);
      const onMessage = getWebViewCallbacks().onMessage;

      // Act
      await act(async () => {
        onMessage?.({
          nativeEvent: {
            data: "これは不正なJSONです{{{",
          },
        });
      });

      // Assert
      expect(onExtract).not.toHaveBeenCalled();
    });

    it("不正な JSON メッセージでは onSnapshot が呼ばれないこと", async () => {
      // Arrange
      const onSnapshot = jest.fn();
      await render(<ArticleWebView url={TEST_URL} onSnapshot={onSnapshot} />);
      const onMessage = getWebViewCallbacks().onMessage;

      // Act
      await act(async () => {
        onMessage?.({
          nativeEvent: {
            data: "malformed",
          },
        });
      });

      // Assert
      expect(onSnapshot).not.toHaveBeenCalled();
    });

    it("type が extracted_text でも text が文字列でなければ onExtract が呼ばれないこと", async () => {
      // Arrange
      const onExtract = jest.fn();
      await render(<ArticleWebView url={TEST_URL} onExtract={onExtract} />);
      const onMessage = getWebViewCallbacks().onMessage;

      // Act
      await act(async () => {
        onMessage?.({
          nativeEvent: {
            data: JSON.stringify({
              type: "extracted_text",
              title: "テスト記事",
              text: 12345,
              url: TEST_URL,
            }),
          },
        });
      });

      // Assert
      expect(onExtract).not.toHaveBeenCalled();
    });

    it("type が snapshot_html でも html が文字列でなければ onSnapshot が呼ばれないこと", async () => {
      // Arrange
      const onSnapshot = jest.fn();
      await render(<ArticleWebView url={TEST_URL} onSnapshot={onSnapshot} />);
      const onMessage = getWebViewCallbacks().onMessage;

      // Act
      await act(async () => {
        onMessage?.({
          nativeEvent: {
            data: JSON.stringify({
              type: "snapshot_html",
              html: null,
              url: TEST_URL,
            }),
          },
        });
      });

      // Assert
      expect(onSnapshot).not.toHaveBeenCalled();
    });

    it("url が省略された extracted_text メッセージでは props の url を使うこと", async () => {
      // Arrange
      const onExtract = jest.fn();
      await render(<ArticleWebView url={TEST_URL} onExtract={onExtract} />);
      const onMessage = getWebViewCallbacks().onMessage;

      // Act
      await act(async () => {
        onMessage?.({
          nativeEvent: {
            data: JSON.stringify({
              type: "extracted_text",
              title: "タイトル",
              text: "本文",
            }),
          },
        });
      });

      // Assert
      expect(onExtract).toHaveBeenCalledWith({
        title: "タイトル",
        text: "本文",
        url: TEST_URL,
      });
    });
  });
});
