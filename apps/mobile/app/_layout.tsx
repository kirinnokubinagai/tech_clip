import "../global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import {
  registerForPushNotifications,
  registerTokenWithApi,
  setupNotificationHandlers,
} from "../src/lib/notifications";
import { queryClient } from "../src/lib/query-client";
import { useAuthStore } from "../src/stores/auth-store";
import { useUIStore } from "../src/stores/ui-store";

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const checkSession = useAuthStore((s) => s.checkSession);
  const hasSeenOnboarding = useUIStore((s) => s.hasSeenOnboarding);
  const isOnboardingLoaded = useUIStore((s) => s.isOnboardingLoaded);
  const loadOnboardingState = useUIStore((s) => s.loadOnboardingState);

  useEffect(() => {
    checkSession();
    loadOnboardingState();
  }, [checkSession, loadOnboardingState]);

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
