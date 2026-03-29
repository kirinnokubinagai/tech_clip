/** lucide-react-nativeのモック */
const React = require("react");

/** アイコンコンポーネントのモックファクトリ */
const createMockIcon = (name) => {
  const Icon = () => null;
  Icon.displayName = name;
  return Icon;
};

module.exports = new Proxy(
  {},
  {
    get: (_, name) => createMockIcon(String(name)),
  },
);
