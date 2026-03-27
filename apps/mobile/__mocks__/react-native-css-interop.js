/** react-native-css-interop のモック
 * cssInterop が react-native の Text/View 等をラップするのを防ぎ、
 * jest-expo/node + RNTL v13 で getByText が動作するようにする。
 */
module.exports = {
  cssInterop: () => {},
  remapProps: () => {},
  StyleSheet: {
    create: (styles) => styles,
    hairlineWidth: 1,
    flatten: (style) => style,
  },
  colorScheme: { get: () => "light", set: () => {} },
  createInteropElement: (type, props, ...children) => {
    const React = require("react");
    return React.createElement(type, props, ...children);
  },
  vars: () => ({}),
  rem: { get: () => 16, set: () => {} },
  useSafeAreaEnv: () => ({}),
  useUnstableNativeVariable: () => undefined,
};
