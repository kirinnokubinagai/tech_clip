import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CallbackErrorView, CallbackLoadingView } from "@/components/auth/CallbackViews";
import { useAuthStore } from "@/stores/auth-store";

/** OAuthコールバック状態 */
type CallbackState = "loading" | "error";

/**
 * OAuthコード受け取り型コールバック画面
 *
 * ソーシャルログイン（Google・GitHub等）のプロバイダーが認証後に
 * ディープリンク `techclip://oauth-callback?code=xxx` でアプリに戻る際に
 * expo-routerによって起動されるルート。
 * `useLocalSearchParams` でURLクエリパラメータを取得し、
 * Better Authがサーバーサイドで確立したセッションを checkSession() で確認する。
 *
 * @remarks
 * `auth/callback` との違い:
 * - こちら（(auth)/oauth-callback）はOAuthプロバイダーからcodeを受け取り、
 *   Better Authがサーバーサイドでセッションを確立するフロー
 * - `auth/callback` はAPIサーバーが発行したトークンをクエリパラメータで受け取るフロー
 *
 * checkSession() はコールバックURL受信後に呼び出す。
 * Better Auth はコールバック時にサーバーサイドでセッションCookieを設定済みのため、
 * checkSession() でそのセッションを確認してストアに反映する。
 * トークンの手動保存は不要。
 *
 * エラー時はエラーメッセージと「ログイン画面に戻る」ボタンを表示する。
 * これはユーザーがリカバリできるよう明示的なUXを提供するため。
 *
 * @remarks 到達可能性について
 * 現時点では `login.tsx` の `SOCIAL_CALLBACK_URL` は `techclip://auth/callback` を指しており、
 * このルート（`techclip://oauth-callback`）へ遷移するコードパスは存在しない。
 * 将来 Better Auth のセッションCookieフローへ移行する際に使用する予定のルートである。
 */
export default function OAuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const checkSession = useAuthStore((s) => s.checkSession);
  const params = useLocalSearchParams<{ code?: string; error?: string }>();

  const [state, setState] = useState<CallbackState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (params.error) {
      setErrorMessage(t("auth.oauthCallback.errorSocialLogin"));
      setState("error");
      return;
    }

    if (!params.code) {
      setErrorMessage(t("auth.oauthCallback.errorNoCode"));
      setState("error");
      return;
    }

    let cancelled = false;
    checkSession()
      .then(() => {
        if (cancelled) return;
        router.replace("/(tabs)");
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMessage(t("auth.oauthCallback.errorCheckSession"));
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [params.code, params.error, checkSession, router, t]);

  if (state === "error") {
    return (
      <CallbackErrorView
        message={errorMessage}
        errorTestId="oauth-callback-error"
        backButtonTestId="oauth-callback-back-button"
        onBackToLogin={() => router.replace("/(auth)/login")}
      />
    );
  }

  return (
    <CallbackLoadingView
      loadingTestId="oauth-callback-loading"
      labelKey="auth.oauthCallback.processingLabel"
      messageKey="auth.oauthCallback.processing"
    />
  );
}
