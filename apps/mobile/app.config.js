// @ts-check
const baseConfig = require("./app.json");

const TEST_ADMOB_APP_IDS = {
  android: "ca-app-pub-3940256099942544~3347511713",
  ios: "ca-app-pub-3940256099942544~1458002511",
};

const isProductionBuild =
  process.env.APP_ENV === "production" || process.env.EAS_BUILD_PROFILE === "production";

const admobAndroidAppId =
  process.env.ADMOB_ANDROID_APP_ID ?? (isProductionBuild ? undefined : TEST_ADMOB_APP_IDS.android);
const admobIosAppId =
  process.env.ADMOB_IOS_APP_ID ?? (isProductionBuild ? undefined : TEST_ADMOB_APP_IDS.ios);

if (isProductionBuild && (!admobAndroidAppId || !admobIosAppId)) {
  throw new Error(
    "Production builds require ADMOB_ANDROID_APP_ID and ADMOB_IOS_APP_ID; refusing to ship test AdMob app IDs.",
  );
}

const plugins = (baseConfig.expo.plugins ?? []).map((plugin) => {
  const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
  if (pluginName !== "react-native-google-mobile-ads") {
    return plugin;
  }

  const options = /** @type {Record<string, unknown>} */ (
    Array.isArray(plugin) ? (plugin[1] ?? {}) : {}
  );

  return [
    pluginName,
    {
      ...options,
      androidAppId: admobAndroidAppId,
      iosAppId: admobIosAppId,
    },
  ];
});

/** @type {import('expo/config').ExpoConfig} */
const config = {
  ...baseConfig.expo,
  plugins,
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
