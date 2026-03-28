const React = require("react");

module.exports = {
  styled: (component) => component,
  useColorScheme: () => ({ colorScheme: "light" }),
  createInteropElement: (type, props, ...children) =>
    React.createElement(type, props, ...children),
  cssInterop: () => {},
  remapProps: () => {},
  vars: () => ({}),
  StyleSheet: {
    create: (styles) => styles,
    hairlineWidth: 1,
    flatten: (style) => style,
  },
  colorScheme: { get: () => "light", set: () => {} },
  rem: { get: () => 16, set: () => {} },
  useSafeAreaEnv: () => ({}),
  useUnstableNativeVariable: () => undefined,
  verifyInstallation: () => {},
};
