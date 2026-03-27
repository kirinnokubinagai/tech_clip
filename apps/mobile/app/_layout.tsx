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

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

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

  if (isLoading) {
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
        <Stack.Screen name="article/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="profile/edit" options={{ presentation: "card" }} />
      </Stack>
      {!isAuthenticated && <Redirect href="/(auth)/login" />}
      {isAuthenticated && <Redirect href="/(tabs)" />}
    </QueryClientProvider>
  );
}
