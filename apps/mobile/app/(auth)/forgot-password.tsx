import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { fetchWithTimeout, getBaseUrl } from "@/lib/api";
import { AUTH_LOADING_INDICATOR_COLOR, AUTH_PLACEHOLDER_TEXT_COLOR } from "@/lib/ui-colors";

type ForgotPasswordSuccessResponse = {
  success: true;
  data: { message: string };
};

type ForgotPasswordErrorResponse = {
  success: false;
  error: { message: string };
};

/** パスワードリセットAPIのパス */
const FORGOT_PASSWORD_PATH = "/api/auth/forgot-password";
/** メールアドレスの簡易バリデーション正規表現（空白なし・@あり・ドメインにドットあり） */
const EMAIL_SIMPLE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isForgotPasswordErrorResponse(
  data: ForgotPasswordSuccessResponse | ForgotPasswordErrorResponse,
): data is ForgotPasswordErrorResponse {
  return !data.success && "error" in data && typeof data.error?.message === "string";
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  /**
   * パスワードリセットメール送信フォームを送信する
   */
  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    const hasValidEmailFormat = EMAIL_SIMPLE_REGEX.test(trimmedEmail);

    if (!trimmedEmail) {
      setErrorMessage(t("auth.validation.emailRequired"));
      return;
    }
    if (!hasValidEmailFormat) {
      setErrorMessage(t("auth.validation.emailInvalid"));
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetchWithTimeout(`${getBaseUrl()}${FORGOT_PASSWORD_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = (await response.json()) as
        | ForgotPasswordSuccessResponse
        | ForgotPasswordErrorResponse;

      if (!response.ok || !data.success) {
        setErrorMessage(
          isForgotPasswordErrorResponse(data) ? data.error.message : t("common.error"),
        );
        return;
      }

      setSuccessMessage(data.data.message || t("auth.forgotPasswordSuccess"));
    } catch {
      setErrorMessage(t("common.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-10 items-center">
          <Text className="text-3xl font-bold text-text">{t("auth.forgotPasswordTitle")}</Text>
          <Text className="mt-2 text-center text-base text-text-muted">
            {t("auth.forgotPasswordDescription")}
          </Text>
        </View>

        {errorMessage !== "" && (
          <View
            className="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3"
            accessibilityRole="alert"
            accessibilityLabel={errorMessage}
          >
            <Text className="text-sm text-error">{errorMessage}</Text>
          </View>
        )}

        {successMessage !== "" && (
          <View
            className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3"
            accessibilityRole="alert"
            accessibilityLabel={successMessage}
          >
            <Text className="text-sm text-primary">{successMessage}</Text>
          </View>
        )}

        <View>
          <Text className="mb-1.5 text-sm font-medium text-text-muted">{t("auth.email")}</Text>
          <TextInput
            className="rounded-lg border border-border bg-card px-4 py-3 text-base text-text"
            placeholder={t("auth.emailPlaceholder")}
            placeholderTextColor={AUTH_PLACEHOLDER_TEXT_COLOR}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isSubmitting}
            accessibilityLabel={t("auth.email")}
            accessibilityHint={t("auth.forgotPasswordEmailHint")}
          />
        </View>

        <Pressable
          className="mt-6 items-center rounded-lg bg-primary py-3.5"
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={({ pressed }) => ({
            opacity: pressed || isSubmitting ? 0.7 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel={t("auth.forgotPasswordSubmit")}
          accessibilityState={{ disabled: isSubmitting }}
        >
          {isSubmitting ? (
            <ActivityIndicator color={AUTH_LOADING_INDICATOR_COLOR} />
          ) : (
            <Text className="text-base font-semibold text-white">
              {t("auth.forgotPasswordSubmit")}
            </Text>
          )}
        </Pressable>

        {successMessage !== "" ? (
          <Pressable
            className="mt-4 items-center"
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
            accessibilityLabel={t("auth.login")}
          >
            <Text className="text-sm font-semibold text-primary">{t("auth.login")}</Text>
          </Pressable>
        ) : (
          <View className="mt-6 flex-row items-center justify-center">
            <Text className="text-sm text-text-muted">{t("auth.hasAccount")}</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text className="ml-1 text-sm font-semibold text-primary">{t("auth.login")}</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
