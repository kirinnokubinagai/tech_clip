/**
 * Expo config plugin: Android emulator/localhost に対してのみ cleartext HTTP を許可する
 * network_security_config.xml をリソースに追加し、AndroidManifest.xml の <application>
 * に android:networkSecurityConfig="@xml/network_security_config" を付与する。
 *
 * 本番環境では HTTPS のみ許可、E2E/開発時のみ 10.0.2.2 / 127.0.0.1 / localhost を
 * cleartext で許可する設計。
 *
 * Production build では何もしない (security)。EXPO_PUBLIC_E2E_MODE=1 もしくは
 * NODE_ENV !== "production" のときのみ plugin が effect する。
 */
const fs = require("node:fs");
const path = require("node:path");

const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<!--
  Network security config: 本番は HTTPS のみ許可、emulator dev/E2E のみ cleartext を許可。
  10.0.2.2 = Android emulator から host machine への loopback alias
  127.0.0.1 / localhost = host machine 直接アクセス時
-->
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

/**
 * production build では plugin を no-op にする。
 * E2E_MODE=1 もしくは NODE_ENV !== "production" のときのみ cleartext config を適用。
 */
function shouldApply() {
  if (process.env.EXPO_PUBLIC_E2E_MODE === "1") {
    return true;
  }
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return true;
}

function withAndroidCleartextLocalhost(config) {
  if (!shouldApply()) {
    return config;
  }

  // 1) network_security_config.xml を res/xml に書き出す
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const resPath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      );
      fs.mkdirSync(resPath, { recursive: true });
      fs.writeFileSync(path.join(resPath, "network_security_config.xml"), NETWORK_SECURITY_CONFIG);
      return config;
    },
  ]);

  // 2) AndroidManifest.xml の <application> に networkSecurityConfig 属性を付与
  config = withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return config;
  });

  return config;
}

module.exports = createRunOncePlugin(
  withAndroidCleartextLocalhost,
  "with-android-cleartext-localhost",
  "1.0.0",
);
