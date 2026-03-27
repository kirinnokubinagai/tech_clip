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
