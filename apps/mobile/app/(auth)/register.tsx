import { Link } from "expo-router";
import { useState } from "react";
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

import { useAuthStore } from "../../src/stores/auth-store";

export default function RegisterScreen() {
  const signIn = useAuthStore((s) => s.signIn);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /**
   * 新規登録フォームを送信する
   * Phase 0ではsignInを呼び出すプレースホルダー実装
   */
  async function handleRegister() {
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("名前を入力してください");
      return;
    }
    if (!email.trim()) {
      setErrorMessage("メールアドレスを入力してください");
      return;
    }
    if (!password.trim()) {
      setErrorMessage("パスワードを入力してください");
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn({ email: email.trim(), password });
    } catch (error: unknown) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("登録に失敗しました");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

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
          <Text className="text-3xl font-bold text-text">TechClip</Text>
          <Text className="mt-2 text-base text-text-muted">アカウントを作成</Text>
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

        <View className="gap-4">
          <View>
            <Text className="mb-1.5 text-sm font-medium text-text-muted">名前</Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text"
              placeholder="名前を入力"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              editable={!isSubmitting}
              accessibilityLabel="名前"
              accessibilityHint="お名前を入力してください"
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-text-muted">メールアドレス</Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text"
              placeholder="example@domain.com"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isSubmitting}
              accessibilityLabel="メールアドレス"
              accessibilityHint="メールアドレスを入力してください"
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-text-muted">パスワード</Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text"
              placeholder="8文字以上"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!isSubmitting}
              accessibilityLabel="パスワード"
              accessibilityHint="8文字以上のパスワードを入力してください"
            />
          </View>
        </View>

        <Pressable
          className="mt-6 items-center rounded-lg bg-primary py-3.5"
          onPress={handleRegister}
          disabled={isSubmitting}
          style={({ pressed }) => ({
            opacity: pressed || isSubmitting ? 0.7 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel="アカウントを作成"
          accessibilityHint="入力した情報で新規アカウントを作成します"
          accessibilityState={{ disabled: isSubmitting }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-base font-semibold text-white">アカウントを作成</Text>
          )}
        </Pressable>

        <View className="mt-6 flex-row items-center justify-center">
          <Text className="text-sm text-text-muted">すでにアカウントをお持ちですか？</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text className="ml-1 text-sm font-semibold text-primary">ログイン</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
