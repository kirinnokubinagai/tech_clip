module.exports = {
  preset: "jest-expo/node",
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-reanimated|lucide-react-native|zustand|@tanstack|react-native-purchases))",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^nativewind$": "<rootDir>/__mocks__/nativewind.js",
    "^lucide-react-native$": "<rootDir>/__mocks__/lucide-react-native.js",
    "^react-native-css-interop$": "<rootDir>/__mocks__/react-native-css-interop.js",
  },
};
