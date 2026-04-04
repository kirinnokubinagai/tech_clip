/** テストタイムアウト（ミリ秒） */
const TEST_TIMEOUT_MS = 30000;

module.exports = {
  preset: "jest-expo",
  testTimeout: TEST_TIMEOUT_MS,
  watchman: false,
  roots: ["<rootDir>/../../tests/mobile"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-reanimated|lucide-react-native|zustand|@tanstack|react-native-purchases|@shopify/flash-list))",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  moduleNameMapper: {
    "\\.css$": "<rootDir>/__mocks__/fileMock.js",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@mobile/(.*)$": "<rootDir>/src/$1",
    "^@mobile-app/(.*)$": "<rootDir>/app/$1",
    "^nativewind$": "<rootDir>/__mocks__/nativewind.js",
    "^lucide-react-native$": "<rootDir>/__mocks__/lucide-react-native.js",
    "^react-native-css-interop$": "<rootDir>/__mocks__/react-native-css-interop.js",
    "^react-native-css-interop/jsx-runtime$": "react/jsx-runtime",
    "^react-native-css-interop/jsx-dev-runtime$": "react/jsx-dev-runtime",
    "^react-native-css-interop/(.*)$": "<rootDir>/__mocks__/react-native-css-interop.js",
    "^expo-image$": "<rootDir>/__mocks__/expo-image.js",
    "^react-native-safe-area-context$": "<rootDir>/__mocks__/react-native-safe-area-context.js",
    "^expo-router$": "<rootDir>/__mocks__/expo-router.js",
    "^react-i18next$": "<rootDir>/__mocks__/react-i18next.js",
  },
};
