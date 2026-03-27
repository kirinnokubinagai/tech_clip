// jest-expo setup workaround for React Native compatibility

// NativeWind v4 CSS interop mock for Jest environment
// The babel plugin transforms className props into _ReactNativeCSSInterop calls,
// which need to be available as a global in the test environment.
global._ReactNativeCSSInterop = (component) => component;
