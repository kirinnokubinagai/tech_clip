// React 19 act() warning を抑制
// RNTL が内部で act() を使用しているが、非同期の状態更新で警告が出る既知の問題
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === "string" &&
    (args[0].includes("was not wrapped in act") ||
      args[0].includes("The current testing environment is not configured to support act"))
  ) {
    return;
  }
  originalConsoleError(...args);
};

const originalConsoleInfo = console.info;
console.info = (...args) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("i18next is made possible by our own product, Locize")
  ) {
    return;
  }
  originalConsoleInfo(...args);
};

// jest-expo setup workaround for React Native compatibility

// NativeWind v4 CSS interop mock for Jest environment
const React = require("react");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
global._ReactNativeCSSInterop = {
  createInteropElement: (type, props, ...children) => React.createElement(type, props, ...children),
  cssInterop: () => {},
  remapProps: () => {},
};

// Configure RNTL for native test-renderer.
const { configure } = require("@testing-library/react-native");
configure({ defaultIncludeHiddenElements: true });

// React Native Animated uses requestAnimationFrame which is not available in Node.js
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// react-native-web TextInput uses document in a useEffect; provide a minimal stub
// so tests using TextInput don't crash in the Node test environment.
if (typeof global.document === "undefined") {
  global.document = {
    createElement: () => ({ style: {}, addEventListener: () => {}, removeEventListener: () => {} }),
    createTextNode: () => ({}),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    body: { style: {}, appendChild: () => {}, removeChild: () => {} },
    head: { appendChild: () => {}, removeChild: () => {} },
    documentElement: { style: {} },
  };
}
