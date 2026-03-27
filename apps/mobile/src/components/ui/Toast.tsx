import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

/** トーストの種別 */
type ToastVariant = "success" | "error" | "info";

type ToastProps = {
  message: string;
  variant?: ToastVariant;
  visible: boolean;
  onDismiss: () => void;
};

/** 自動消去までの時間（ミリ秒） */
const AUTO_DISMISS_MS = 3000;

/** アニメーション時間（ミリ秒） */
const ANIMATION_DURATION_MS = 300;

/** バリアントごとのコンテナスタイル */
const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "bg-success",
  error: "bg-error",
  info: "bg-primary",
};

/**
 * トースト通知コンポーネント
 *
 * 成功・エラー・情報の3種類を表示し、一定時間後に自動消去する。
 * スライドイン・フェードアウトのアニメーション付き。
 *
 * @param message - 表示するメッセージ
 * @param variant - トーストの種別（success / error / info）
 * @param visible - 表示状態
 * @param onDismiss - 非表示時のコールバック
 */
export function Toast({ message, variant = "info", visible, onDismiss }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: ANIMATION_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: ANIMATION_DURATION_MS,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss();
      });
    }, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [visible, translateY, opacity, onDismiss]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 60,
        left: 16,
        right: 16,
        zIndex: 9999,
        transform: [{ translateY }],
        opacity,
      }}
    >
      <Pressable onPress={onDismiss} accessibilityRole="alert">
        <View className={`rounded-lg px-4 py-3 ${VARIANT_STYLES[variant]}`}>
          <Text className="text-white text-sm font-medium">{message}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
