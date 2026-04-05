import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CallbackErrorView, CallbackLoadingView } from "@/components/auth/CallbackViews";
import { setAuthToken, setRefreshToken } from "@/lib/secure-store";
import { useAuthStore } from "@/stores/auth-store";

/** コールバック状態 */
type CallbackState = "loading" | "error";

/**
 * トークン受け取り型OAuthコールバック画面
 *
 * ソーシャルログイン後のディープリンク `techclip://auth/callback?token=...` を処理する。
 * APIサーバーが発行したトークンをクエリパラメータで受け取り、セキュアストレージに保存する。
 * セッションを確立してホーム画面へ遷移する。
 *
 * @remarks
 * `(auth)/oauth-callback` との違い:
 * - こちら（auth/callback）はAPIサーバーからトークンを直接受け取るフロー
 * - `(auth)/oauth-callback` はOAuthプロバイダーからcodeを受け取りBetter Authに委譲するフロー
 *
 * エラー時のUXについて:
 * `(auth)/oauth-callback` と同様にエラーメッセージ + 「ログイン画面に戻る」ボタンを表示する。
 * トークンベースのコールバックも失敗時にユーザーが明示的に操作できるUXを統一して提供する。
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string; refresh_token?: string; error?: string }>();
  const router = useRouter();
  const checkSession = useAuthStore((s) => s.checkSession);
  const { t } = useTranslation();

  const [state, setState] = useState<CallbackState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (params.error) {
        setErrorMessage(t("auth.authCallback.errorSocialLogin"));
        setState("error");
        return;
      }

      if (!params.token) {
        setErrorMessage(t("auth.authCallback.errorNoToken"));
        setState("error");
        return;
      }

      try {
        if (cancelled) return;
        await setAuthToken(params.token);
        if (params.refresh_token) {
          if (cancelled) return;
          await setRefreshToken(params.refresh_token);
        }
      } catch {
        if (cancelled) return;
        setErrorMessage(t("auth.authCallback.errorSaveToken"));
        setState("error");
        return;
      }

      try {
        if (cancelled) return;
        await checkSession();
        if (cancelled) return;
        router.replace("/(tabs)");
      } catch {
        if (cancelled) return;
        setErrorMessage(t("auth.authCallback.errorCheckSession"));
        setState("error");
      }
    }
    run();

    return () => {
      cancelled = true;
    };
  }, [params.error, params.token, params.refresh_token, checkSession, router, t]);

  if (state === "error") {
    return (
      <CallbackErrorView
        message={errorMessage}
        errorTestId="auth-callback-error"
        backButtonTestId="auth-callback-back-button"
        onBackToLogin={() => router.replace("/(auth)/login")}
      />
    );
  }

  return (
    <CallbackLoadingView
      loadingTestId="auth-callback-loading"
      labelKey="auth.signingIn"
      messageKey="auth.signingIn"
    />
  );
}
