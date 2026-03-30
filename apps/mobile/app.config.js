// @ts-check
const baseConfig = require("./app.json");

/** @type {import('expo/config').ExpoConfig} */
const config = {
  ...baseConfig.expo,
  extra: {
    ...baseConfig.expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787",
  },
};

module.exports = { expo: config };
