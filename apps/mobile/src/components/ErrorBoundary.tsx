import { AlertTriangle, RefreshCw } from "lucide-react-native";
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/** エラーアイコンサイズ（px） */
const ERROR_ICON_SIZE = 48;

/** エラーアイコン色 */
const ERROR_ICON_COLOR = "#ef4444";

/** リトライアイコンサイズ（px） */
const RETRY_ICON_SIZE = 20;

/** リトライアイコン色 */
const RETRY_ICON_COLOR = "#6366f1";

/**
 * グローバルエラーバウンダリ
 *
 * 子コンポーネントツリーで発生した未キャッチのJavaScriptエラーをキャッチし、
 * クラッシュの代わりにリカバリUIを表示する。
 *
 * @param children - ラップする子コンポーネント
 * @param fallback - カスタムフォールバックUI（省略時はデフォルトのエラーUIを表示）
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (__DEV__) {
      const componentStack = errorInfo.componentStack ?? "不明";
      const errorMessage = error.message;
      const devMessage = `[ErrorBoundary] ${errorMessage}\n${componentStack}`;
      void devMessage;
    }
  }

  /**
   * エラー状態をリセットしてリトライする
   */
  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <View
        testID="error-boundary-fallback"
        className="flex-1 items-center justify-center bg-background px-8"
      >
        <AlertTriangle
          testID="error-boundary-icon"
          size={ERROR_ICON_SIZE}
          color={ERROR_ICON_COLOR}
        />
        <Text className="text-lg font-semibold text-text mt-4 text-center">
          予期しないエラーが発生しました
        </Text>
        <Text className="text-sm text-text-muted mt-2 text-center">
          {this.state.error?.message ?? "アプリケーションでエラーが発生しました"}
        </Text>
        <Pressable
          testID="error-boundary-retry"
          onPress={this.handleRetry}
          className="flex-row items-center gap-2 mt-6 rounded-lg bg-primary px-5 py-3"
          accessibilityRole="button"
          accessibilityLabel="再試行"
        >
          <RefreshCw size={RETRY_ICON_SIZE} color="#ffffff" />
          <Text className="text-white font-semibold">再試行</Text>
        </Pressable>
      </View>
    );
  }
}
