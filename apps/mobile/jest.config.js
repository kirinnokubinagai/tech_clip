module.exports = {
  preset: "jest-expo/node",
  watchman: false,
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-reanimated|lucide-react-native|zustand|@tanstack|react-native-purchases|@shopify/flash-list))",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^react-native$": "<rootDir>/__mocks__/react-native.js",
    "^nativewind$": "<rootDir>/__mocks__/nativewind.js",
    "^lucide-react-native$": "<rootDir>/__mocks__/lucide-react-native.js",
    "^react-native-css-interop$": "<rootDir>/__mocks__/react-native-css-interop.js",
    "^react-native-css-interop/jsx-runtime$": "react/jsx-runtime",
    "^react-native-css-interop/jsx-dev-runtime$": "react/jsx-dev-runtime",
    "^react-native-css-interop/(.*)$": "<rootDir>/__mocks__/react-native-css-interop.js",
    "^expo-image$": "<rootDir>/__mocks__/expo-image.js",
  },
};
