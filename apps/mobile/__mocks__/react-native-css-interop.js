/** react-native-css-interop のモック
 * cssInterop が react-native の Text/View 等をラップするのを防ぎ、
 * jest-expo/node + RNTL v13 で getByText が動作するようにする。
 */
const actualReact = jest.requireActual("react");
const originalCreateElement = actualReact.createElement.bind(actualReact);

const interopExports = {
  cssInterop: () => {},
  remapProps: () => {},
  StyleSheet: {
    create: (styles) => styles,
    hairlineWidth: 1,
    flatten: (style) => style,
  },
  colorScheme: { get: () => "light", set: () => {} },
  createInteropElement: (type, props, ...children) => {
    return originalCreateElement(type, props, ...children);
  },
  vars: () => ({}),
  rem: { get: () => 16, set: () => {} },
  useSafeAreaEnv: () => ({}),
  useUnstableNativeVariable: () => undefined,
};

module.exports = interopExports;
module.exports.default = interopExports;
