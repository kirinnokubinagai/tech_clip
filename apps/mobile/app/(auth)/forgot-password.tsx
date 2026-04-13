import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { fetchWithTimeout, getBaseUrl } from "@/lib/api";
import { DARK_COLORS } from "@/lib/constants";
import { EMAIL_SIMPLE_REGEX } from "@/lib/validation";

function hasForgotPasswordMessageShape(value: unknown): value is { data: { message: string } } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("data" in value)) {
    return false;
  }

  const data = (value as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return false;
  }

  if (!("message" in data)) {
    return false;
  }

  return typeof (data as { message?: unknown }).message === "string";
}

/** パスワードリセットAPIのパス */
const FORGOT_PASSWORD_PATH = "/api/auth/forgot-password";

/**
 * パスワードリセット画面のフッター
 *
 * @param hasSuccess - 送信成功状態
 */
function ForgotPasswordFooter({ hasSuccess }: { hasSuccess: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();

  if (hasSuccess) {
    return (
      <Pressable
        className="mt-4 items-center"
        onPress={() => router.replace("/(auth)/login")}
        accessibilityRole="button"
        accessibilityLabel={t("auth.login")}
      >
        <Text className="text-sm font-semibold text-primary">{t("auth.login")}</Text>
      </Pressable>
    );
  }

  return (
    <View className="mt-6 flex-row items-center justify-center">
      <Text className="text-sm text-text-muted">{t("auth.hasAccount")}</Text>
      <Link href="/(auth)/login" asChild>
        <Pressable>
          <Text className="ml-1 text-sm font-semibold text-primary">{t("auth.login")}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();

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

      if (!response.ok) {
        // ユーザー列挙攻撃を防ぐため、エラー時も成功と同じ文言を返して存在有無を隠す。
        setSuccessMessage(t("auth.forgotPasswordSuccess"));
        return;
      }

      let serverMessage: string | undefined;

      try {
        const responseBody: unknown = await response.json();
        if (hasForgotPasswordMessageShape(responseBody)) {
          serverMessage = responseBody.data.message;
        }
      } catch {
        // レスポンス JSON が壊れていても、サーバー側の送信処理自体は成功している可能性がある。
      }

      setSuccessMessage(serverMessage ?? t("auth.forgotPasswordSuccess"));
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

        {errorMessage !== "" && <AuthAlert message={errorMessage} />}

        {successMessage !== "" && <AuthAlert message={successMessage} variant="success" />}

        <View>
          <Text className="mb-1.5 text-sm font-medium text-text-muted">{t("auth.email")}</Text>
          <TextInput
            className="rounded-lg border border-border bg-card px-4 py-3 text-base text-text"
            placeholder={t("auth.emailPlaceholder")}
            placeholderTextColor={DARK_COLORS.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isSubmitting}
            testID="forgot-password-email-input"
            accessibilityLabel={t("auth.email")}
            accessibilityHint={t("auth.forgotPasswordEmailHint")}
          />
        </View>

        <AuthSubmitButton
          className="mt-6"
          onPress={handleSubmit}
          disabled={isSubmitting}
          isLoading={isSubmitting}
          label={t("auth.forgotPasswordSubmit")}
          testID="forgot-password-submit-button"
        />

        <ForgotPasswordFooter hasSuccess={successMessage !== ""} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
