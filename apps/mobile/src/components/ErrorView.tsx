import { AlertCircle, RefreshCw, WifiOff } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

/** エラー種別 */
type ErrorType = "network" | "server" | "generic";

type ErrorViewProps = {
  title?: string;
  message?: string;
  errorType?: ErrorType;
  onRetry?: () => void;
  retryLabel?: string;
};

/** エラーアイコンサイズ（px） */
const ERROR_VIEW_ICON_SIZE = 48;

/** リトライアイコンサイズ（px） */
const RETRY_VIEW_ICON_SIZE = 16;

/**
 * エラー種別に対応するアイコンを返す
 *
 * @param errorType - エラー種別
 * @param errorTypeColors - テーマ連動のエラー色マップ
 * @returns Lucideアイコンコンポーネント
 */
function getErrorIcon(errorType: ErrorType, errorTypeColors: Record<ErrorType, string>): ReactNode {
  const color = errorTypeColors[errorType];

  switch (errorType) {
    case "network":
      return <WifiOff testID="error-view-icon-network" size={ERROR_VIEW_ICON_SIZE} color={color} />;
    case "server":
      return (
        <AlertCircle testID="error-view-icon-server" size={ERROR_VIEW_ICON_SIZE} color={color} />
      );
    case "generic":
      return (
        <AlertCircle testID="error-view-icon-generic" size={ERROR_VIEW_ICON_SIZE} color={color} />
      );
  }
}

/**
 * APIエラー時の再試行UIコンポーネント
 *
 * ネットワークエラー、サーバーエラーなどの種別に応じたアイコンとメッセージを表示し、
 * オプションで再試行ボタンを提供する。
 *
 * @param title - エラータイトル（省略時はerrorTypeから自動設定）
 * @param message - エラーメッセージ（省略時はerrorTypeから自動設定）
 * @param errorType - エラー種別
 * @param onRetry - 再試行ボタンタップ時のコールバック
 * @param retryLabel - 再試行ボタンのラベル
 */
export function ErrorView({
  title,
  message,
  errorType = "generic",
  onRetry,
  retryLabel,
}: ErrorViewProps) {
  const { t } = useTranslation();
  const COLORS = useColors();

  /** エラー種別ごとのアイコン色 */
  const ERROR_TYPE_COLORS: Record<ErrorType, string> = {
    network: COLORS.warning,
    server: COLORS.error,
    generic: COLORS.error,
  };

  const defaultTitles: Record<ErrorType, string> = {
    network: t("errorView.titles.network"),
    server: t("errorView.titles.server"),
    generic: t("errorView.titles.generic"),
  };

  const defaultMessages: Record<ErrorType, string> = {
    network: t("errorView.messages.network"),
    server: t("errorView.messages.server"),
    generic: t("errorView.messages.generic"),
  };

  const displayTitle = title ?? defaultTitles[errorType];
  const displayMessage = message ?? defaultMessages[errorType];
  const displayRetryLabel = retryLabel ?? t("errorView.retry");

  return (
    <View testID="error-view" className="flex-1 items-center justify-center px-8 py-12">
      {getErrorIcon(errorType, ERROR_TYPE_COLORS)}

      <Text testID="error-view-title" className="text-lg font-semibold text-text mt-4 text-center">
        {displayTitle}
      </Text>

      <Text testID="error-view-message" className="text-sm text-text-muted mt-2 text-center">
        {displayMessage}
      </Text>

      {onRetry && (
        <Pressable
          testID="error-view-retry"
          onPress={onRetry}
          className="flex-row items-center gap-2 mt-6 rounded-lg bg-primary px-5 py-3"
          accessibilityRole="button"
          accessibilityLabel={displayRetryLabel}
        >
          <RefreshCw size={RETRY_VIEW_ICON_SIZE} color={COLORS.white} />
          <Text className="text-white font-semibold">{displayRetryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
