import "../global.css";
import "../src/lib/i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  DEFAULT_BACKGROUND_SYNC_CONFIG,
  registerNativeBackgroundFetch,
  startBackgroundSync,
} from "../src/lib/backgroundSync";
import i18n from "../src/lib/i18n";
import { logger } from "../src/lib/logger";
import {
  registerForPushNotifications,
  registerTokenWithApi,
  setupNotificationHandlers,
} from "../src/lib/notifications";
import { queryClient } from "../src/lib/query-client";
import { configureRevenueCat } from "../src/lib/revenueCat";
import { initSentry } from "../src/lib/sentry";
import { requestTrackingPermission } from "../src/lib/tracking";
import { useAuthStore } from "../src/stores/auth-store";
import { useSettingsStore } from "../src/stores/settings-store";
import { useUIStore } from "../src/stores/ui-store";

initSentry(process.env.EXPO_PUBLIC_SENTRY_DSN);

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const checkSession = useAuthStore((s) => s.checkSession);
  const hasSeenOnboarding = useUIStore((s) => s.hasSeenOnboarding);
  const isOnboardingLoaded = useUIStore((s) => s.isOnboardingLoaded);
  const loadOnboardingState = useUIStore((s) => s.loadOnboardingState);
  const language = useSettingsStore((s) => s.language);
  const loadLanguage = useSettingsStore((s) => s.loadLanguage);

  useEffect(() => {
    checkSession();
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
  }, [checkSession, loadOnboardingState, loadLanguage]);

  useEffect(() => {
    const cleanup = setupNotificationHandlers();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotifications().then((token) => {
      if (token) {
        registerTokenWithApi(token);
      }
    });
  }, [isAuthenticated]);

  useEffect(() => {
    const i18nLanguage = language === "English" ? "en" : "ja";
    void i18n.changeLanguage(i18nLanguage);
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="article/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="profile/edit" options={{ presentation: "card" }} />
        <Stack.Screen name="settings/change-password" options={{ presentation: "card" }} />
        <Stack.Screen name="share-intent" options={{ presentation: "modal" }} />
      </Stack>
      {!hasSeenOnboarding && <Redirect href="/onboarding" />}
      {hasSeenOnboarding && !isAuthenticated && <Redirect href="/(auth)/login" />}
      {hasSeenOnboarding && isAuthenticated && <Redirect href="/(tabs)" />}
    </QueryClientProvider>
  );
}
