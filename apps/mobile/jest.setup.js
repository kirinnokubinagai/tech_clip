// jest-expo setup workaround for React Native compatibility

// NativeWind v4 CSS interop mock for Jest environment
// The babel plugin transforms className props into _ReactNativeCSSInterop calls,
// which need to be available as a global in the test environment.
global._ReactNativeCSSInterop = (component) => component;

// jest-expo/node renders testID as data-testid in DOM.
// Configure RNTL to use data-testid so getByTestId works correctly.
const { configure } = require("@testing-library/react-native");
configure({ defaultIncludeHiddenElements: true, testIdAttribute: "data-testid" });
