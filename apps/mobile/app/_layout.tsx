import "../global.css";
import "../src/lib/i18n";

import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, LogBox, View } from "react-native";

import { OfflineBanner } from "../src/components/OfflineBanner";
import {
  DEFAULT_BACKGROUND_SYNC_CONFIG,
  registerNativeBackgroundFetch,
  startBackgroundSync,
} from "../src/lib/backgroundSync";
import i18n from "../src/lib/i18n";
import { logger } from "../src/lib/logger";
import {
  registerPushTokenOnly,
  requestNotificationPermission,
  setupNotificationHandlers,
} from "../src/lib/notifications";
import { queryClient } from "../src/lib/query-client";
import { configureRevenueCat } from "../src/lib/revenueCat";
import { initSentry } from "../src/lib/sentry";
import { requestTrackingPermission } from "../src/lib/tracking";
import { useAuthStore } from "../src/stores/auth-store";
import { useSettingsStore } from "../src/stores/settings-store";
import { useUIStore } from "../src/stores/ui-store";

/** E2E テスト実行時（EXPO_PUBLIC_E2E_MODE=1）のみ全ログを抑止する */
const IS_E2E = process.env.EXPO_PUBLIC_E2E_MODE === "1";
if (IS_E2E) {
  LogBox.ignoreAllLogs(true);
} else {
  LogBox.ignoreLogs([
    // expo-background-fetch の非推奨警告: 既知の問題、後続 Issue #855 で移行予定
    /expo-background-fetch: This library is deprecated/,
  ]);
}
initSentry(process.env.EXPO_PUBLIC_SENTRY_DSN);

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const segments = useSegments();
  /** (auth) グループ内にいるかどうか */
  const isAuthSegment = segments[0] === "(auth)";
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasAccount = useAuthStore((s) => s.hasAccount);
  const checkSession = useAuthStore((s) => s.checkSession);
  const loadAccountFlag = useAuthStore((s) => s.loadAccountFlag);
  const hasSeenOnboarding = useUIStore((s) => s.hasSeenOnboarding);
  const isOnboardingLoaded = useUIStore((s) => s.isOnboardingLoaded);
  const loadOnboardingState = useUIStore((s) => s.loadOnboardingState);
  const language = useSettingsStore((s) => s.language);
  const loadLanguage = useSettingsStore((s) => s.loadLanguage);

  useEffect(() => {
    checkSession();
    void loadAccountFlag();
    loadOnboardingState();
    void loadLanguage();
    void requestTrackingPermission();
    void configureRevenueCat().catch((error: unknown) => {
      logger.warn("RevenueCat設定に失敗しました", { error });
    });
    void registerNativeBackgroundFetch(DEFAULT_BACKGROUND_SYNC_CONFIG).catch((error: unknown) => {
      logger.warn("バックグラウンドフェッチの登録に失敗しました", { error });
    });
    const bgSyncCleanup = startBackgroundSync();
    return bgSyncCleanup;
  }, [checkSession, loadOnboardingState, loadLanguage, loadAccountFlag]);

  useEffect(() => {
    const cleanup = setupNotificationHandlers();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void (async () => {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        return;
      }
      await registerPushTokenOnly();
    })().catch((error: unknown) => {
      logger.warn("通知初期化に失敗しました", { error });
    });
  }, [isAuthenticated]);

  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);

  if (isLoading || !isOnboardingLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="article/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="article/save" options={{ presentation: "card" }} />
        <Stack.Screen name="profile/edit" options={{ presentation: "card" }} />
        <Stack.Screen name="settings/change-password" options={{ presentation: "card" }} />
        <Stack.Screen name="share-intent" options={{ presentation: "modal" }} />
      </Stack>
      {!hasSeenOnboarding && <Redirect href="/onboarding" />}
      {hasSeenOnboarding && !isAuthenticated && !hasAccount && <Redirect href="/(auth)/register" />}
      {hasSeenOnboarding && !isAuthenticated && hasAccount && <Redirect href="/(auth)/login" />}
      {/* 認証済みかつ (auth) 画面にいるときのみ (tabs) へ redirect。deeplink (article/save 等) は妨げない */}
      {hasSeenOnboarding && isAuthenticated && isAuthSegment && <Redirect href="/(tabs)" />}
    </QueryClientProvider>
  );
}
