const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Adds dev.mobile.maestro to the Android manifest <queries> element.
 * This is required on Android 11+ (API 30+) to allow the TechClip app
 * to interact with the Maestro test driver (package visibility).
 * Without this, Android's AppsFilter blocks cross-package communication
 * and causes Maestro's gRPC connection to time out.
 *
 * Safe to include in all builds — <queries> only declares visibility,
 * it grants no permissions and has no effect when Maestro is absent.
 */
function withAndroidMaestroQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [];
    }

    const alreadyAdded = manifest.queries.some(
      (q) =>
        Array.isArray(q.package) &&
        q.package.some((p) => p.$?.["android:name"] === "dev.mobile.maestro"),
    );

    if (!alreadyAdded) {
      manifest.queries.push({
        package: [{ $: { "android:name": "dev.mobile.maestro" } }],
      });
    }

    return config;
  });
}

module.exports = withAndroidMaestroQueries;
