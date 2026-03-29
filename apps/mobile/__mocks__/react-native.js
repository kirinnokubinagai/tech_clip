/**
 * react-native のテストモック
 *
 * jest-expo/node プリセットは react-native を react-native-web に解決するが、
 * moduleNameMapper でこのファイルを優先させることで AppState.addEventListener を
 * jest.fn() として扱えるようにする。
 */
const reactNativeWeb = jest.requireActual("react-native-web");

module.exports = {
  ...reactNativeWeb,
  AppState: {
    ...reactNativeWeb.AppState,
    addEventListener: jest.fn(),
  },
};
