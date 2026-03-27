import "../global.css";
import "../src/lib/i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import i18n from "../src/lib/i18n";
import { queryClient } from "../src/lib/query-client";
import { useAuthStore } from "../src/stores/auth-store";

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="article/[id]" options={{ presentation: "card" }} />
        </Stack>
        {!isAuthenticated && <Redirect href="/(auth)/login" />}
        {isAuthenticated && <Redirect href="/(tabs)" />}
      </QueryClientProvider>
    </I18nextProvider>
  );
}
