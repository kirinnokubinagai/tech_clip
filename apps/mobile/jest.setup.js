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

// テスト中の期待される挙動によるフォールバック warn を抑制する
// （logger は debug レベルに変更済みだが、console.warn を直接呼ぶ箇所も念のため抑制）
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === "string" &&
    (args[0].includes("フォールバック") ||
      args[0].includes("Fallback") ||
      args[0].includes("fallback") ||
      // RevenueCat ネイティブモジュール未設定警告（テスト環境では常に出る既知の問題）
      args[0].includes("[RevenueCat]"))
  ) {
    return;
  }
  originalConsoleWarn(...args);
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

// Patch Animated to ignore useNativeDriver in test environment to prevent
// "Unable to locate attached view in the native tree" errors
const { Animated } = require("react-native");
const originalTiming = Animated.timing;
Animated.timing = (value, config) => originalTiming(value, { ...config, useNativeDriver: false });
const originalSpring = Animated.spring;
Animated.spring = (value, config) => originalSpring(value, { ...config, useNativeDriver: false });

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

// react-native-webview は native module のため jest 実行時は stub 化する
// モックの実装は apps/mobile/__mocks__/react-native-webview.js に定義されており、
// jest.config.js の moduleNameMapper で自動的に解決される
