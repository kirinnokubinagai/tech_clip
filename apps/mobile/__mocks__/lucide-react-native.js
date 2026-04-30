/** lucide-react-nativeのモック */
const React = require("react");
const { View } = require("react-native");

/** アイコンコンポーネントのモックファクトリ */
const createMockIcon = (name) => {
  const Icon = (props) => React.createElement(View, { ...props });
  Icon.displayName = name;
  return Icon;
};

module.exports = new Proxy(
  {},
  {
    get: (_, name) => createMockIcon(String(name)),
  },
);
