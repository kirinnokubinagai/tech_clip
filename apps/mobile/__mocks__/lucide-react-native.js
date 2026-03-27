const React = require("react");
const { View } = require("react-native");

/** lucide-react-nativeのモック: SVGネイティブモジュール不要のダミーアイコン */
const MockIcon = () => React.createElement(View, { testID: "mock-icon" });

module.exports = new Proxy(
  {},
  {
    get: (_target, name) => {
      if (name === "__esModule") return true;
      return MockIcon;
    },
  },
);
