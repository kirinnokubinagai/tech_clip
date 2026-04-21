const React = require("react");
const { View } = require("react-native");

/**
 * react-native-webview の Jest mock
 * ネイティブモジュールのため Jest 環境では動作しないため stub に差し替える。
 * onMessage / onLoadEnd / onLoadStart コールバックを capturedProps に露出し、
 * テストからイベントをシミュレートできるようにする。
 */

/** テストがコールバックにアクセスするためのキャプチャオブジェクト */
const capturedProps = {
  onMessage: undefined,
  onLoadEnd: undefined,
  onLoadStart: undefined,
};

function WebView(props) {
  capturedProps.onMessage = props.onMessage;
  capturedProps.onLoadEnd = props.onLoadEnd;
  capturedProps.onLoadStart = props.onLoadStart;

  return React.createElement(View, {
    testID: props.testID || "WebView",
    accessible: true,
  });
}

WebView.displayName = "WebView";
WebView.capturedProps = capturedProps;

module.exports = WebView;
module.exports.capturedProps = capturedProps;
module.exports.WebView = WebView;
