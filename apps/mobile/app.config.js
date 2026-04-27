// @ts-check
const baseConfig = require("./app.json");

/** @type {import('expo/config').ExpoConfig} */
const config = {
  ...baseConfig.expo,
  extra: {
    ...baseConfig.expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787",
    apiUrlIos:
      process.env.EXPO_PUBLIC_API_URL_IOS ??
      process.env.EXPO_PUBLIC_API_URL ??
      "http://127.0.0.1:8787",
    apiUrlAndroid:
      process.env.EXPO_PUBLIC_API_URL_ANDROID ??
      process.env.EXPO_PUBLIC_API_URL ??
      "http://10.0.2.2:8787",
  },
};

module.exports = { expo: config };
