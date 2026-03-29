const actualReact = jest.requireActual("react");
const originalCreateElement = actualReact.createElement.bind(actualReact);

module.exports = {
  styled: (component) => component,
  useColorScheme: () => ({ colorScheme: "light" }),
  createInteropElement: (type, props, ...children) =>
    originalCreateElement(type, props, ...children),
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
