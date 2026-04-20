const React = jest.requireActual("react");
const { View } = jest.requireActual("react-native");

/**
 * react-native-webview の Jest mock
 * ネイティブモジュールのため Jest 環境では動作しないため stub に差し替える
 */
const WebView = React.forwardRef(function WebView(props, _ref) {
  return React.createElement(View, {
    testID: props.testID || "WebView",
    accessible: true,
  });
});

WebView.displayName = "WebView";

module.exports = WebView;
module.exports.default = WebView;
module.exports.WebView = WebView;
