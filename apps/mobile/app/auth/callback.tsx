import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CallbackErrorView, CallbackLoadingView } from "@/components/auth/CallbackViews";
import { fetchWithTimeout, getBaseUrl } from "@/lib/api";
import { getOAuthState, removeOAuthState, setAuthToken, setRefreshToken } from "@/lib/secure-store";
import { useAuthStore } from "@/stores/auth-store";

/** コールバック状態 */
type CallbackState = "loading" | "error";

/** exchange API の成功レスポンスの型ガード用 */
type ExchangeSuccessResponse = {
  success: true;
  data: {
    session: { token: string; expiresAt: string };
    refreshToken: string;
  };
};

/**
 * exchange レスポンスが成功形式かどうかを検証する
 */
function isExchangeSuccessResponse(value: unknown): value is ExchangeSuccessResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.success !== true) return false;
  const data = v.data;
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  const session = d.session;
  if (typeof session !== "object" || session === null) return false;
  const s = session as Record<string, unknown>;
  return typeof s.token === "string" && typeof d.refreshToken === "string";
}

/**
 * exchange code 受け取り型 OAuth コールバック画面
 *
 * ソーシャルログイン後のディープリンク `techclip://auth/callback?code=...` を処理する。
 * API サーバーが発行した一度限りの exchange code を受け取り、
 * POST /api/auth/mobile-exchange でセッショントークンと交換してセキュアストレージに保存する。
 * セッションを確立してホーム画面へ遷移する。
 *
 * エラー時はエラーメッセージと「ログイン画面に戻る」ボタンを表示し、
 * ユーザーが明示的に操作できる UX を提供する。
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    state?: string;
  }>();
  const router = useRouter();
  const checkSession = useAuthStore((s) => s.checkSession);
  const { t } = useTranslation();

  const [state, setState] = useState<CallbackState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (params.error) {
        setErrorMessage(t("auth.callback.errorSocialLogin"));
        setState("error");
        return;
      }

      if (!params.code || params.code.trim().length === 0) {
        setErrorMessage(t("auth.callback.errorNoToken"));
        setState("error");
        return;
      }

      const savedState = await getOAuthState();
      await removeOAuthState();
      if (!savedState || !params.state || savedState !== params.state) {
        setErrorMessage(t("auth.callback.errorInvalidState"));
        setState("error");
        return;
      }

      let exchangeData: ExchangeSuccessResponse["data"];
      try {
        const response = await fetchWithTimeout(`${getBaseUrl()}/api/auth/mobile-exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: params.code }),
        });
        const json: unknown = await response.json();
        if (!isExchangeSuccessResponse(json)) {
          if (cancelled) return;
          setErrorMessage(t("auth.callback.errorSocialLogin"));
          setState("error");
          return;
        }
        exchangeData = json.data;
      } catch {
        if (cancelled) return;
        setErrorMessage(t("auth.callback.errorSocialLogin"));
        setState("error");
        return;
      }

      try {
        if (cancelled) return;
        await setAuthToken(exchangeData.session.token);
        if (cancelled) return;
        await setRefreshToken(exchangeData.refreshToken);
      } catch {
        if (cancelled) return;
        setErrorMessage(t("auth.callback.errorSaveToken"));
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
        setErrorMessage(t("auth.callback.errorCheckSession"));
        setState("error");
      }
    }
    run();

    return () => {
      cancelled = true;
    };
  }, [params.error, params.code, params.state, checkSession, router, t]);

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
      message={t("auth.callback.signingIn")}
    />
  );
}
