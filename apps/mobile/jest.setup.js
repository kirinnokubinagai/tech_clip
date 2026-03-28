// jest-expo setup workaround for React Native compatibility

// NativeWind v4 CSS interop mock for Jest environment
global._ReactNativeCSSInterop = (component) => component;

// jest-expo/node renders testID as data-testid in DOM.
// Configure RNTL to use data-testid so getByTestId works correctly.
const { configure } = require("@testing-library/react-native");
configure({ defaultIncludeHiddenElements: true, testIdAttribute: "data-testid" });

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
