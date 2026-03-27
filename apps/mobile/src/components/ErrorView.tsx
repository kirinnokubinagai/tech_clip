import { AlertCircle, RefreshCw, WifiOff } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

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

/** エラー種別ごとのアイコン色 */
const ERROR_TYPE_COLORS: Record<ErrorType, string> = {
  network: "#f59e0b",
  server: "#ef4444",
  generic: "#ef4444",
};

/** エラー種別ごとのデフォルトタイトル */
const DEFAULT_TITLES: Record<ErrorType, string> = {
  network: "ネットワークエラー",
  server: "サーバーエラー",
  generic: "エラーが発生しました",
};

/** エラー種別ごとのデフォルトメッセージ */
const DEFAULT_MESSAGES: Record<ErrorType, string> = {
  network: "インターネット接続を確認してください",
  server: "サーバーで問題が発生しました。しばらくしてから再度お試しください",
  generic: "問題が発生しました。再度お試しください",
};

/** デフォルトリトライラベル */
const DEFAULT_RETRY_LABEL = "再試行";

/**
 * エラー種別に対応するアイコンを返す
 *
 * @param errorType - エラー種別
 * @returns Lucideアイコンコンポーネント
 */
function getErrorIcon(errorType: ErrorType): ReactNode {
  const color = ERROR_TYPE_COLORS[errorType];

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
  retryLabel = DEFAULT_RETRY_LABEL,
}: ErrorViewProps) {
  const displayTitle = title ?? DEFAULT_TITLES[errorType];
  const displayMessage = message ?? DEFAULT_MESSAGES[errorType];

  return (
    <View testID="error-view" className="flex-1 items-center justify-center px-8 py-12">
      {getErrorIcon(errorType)}

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
          accessibilityLabel={retryLabel}
        >
          <RefreshCw size={RETRY_VIEW_ICON_SIZE} color="#ffffff" />
          <Text className="text-white font-semibold">{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
