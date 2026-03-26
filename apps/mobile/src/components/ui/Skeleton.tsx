import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
};

/** アニメーション周期（ミリ秒） */
const ANIMATION_DURATION_MS = 1500;

/** 最小不透明度 */
const MIN_OPACITY = 0.3;

/** 最大不透明度 */
const MAX_OPACITY = 0.7;

/**
 * ローディングプレースホルダーコンポーネント
 *
 * @param width - 幅（数値またはパーセント文字列）
 * @param height - 高さ（数値またはパーセント文字列）
 * @param borderRadius - 角丸の半径
 * @param className - 追加のNativeWindクラス名
 */
export function Skeleton({
  width,
  height,
  borderRadius = 8,
  className = "",
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(MIN_OPACITY)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: MAX_OPACITY,
          duration: ANIMATION_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: MIN_OPACITY,
          duration: ANIMATION_DURATION_MS,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <View className={className}>
      <Animated.View
        style={{
          width,
          height,
          borderRadius,
          opacity,
          /** Animated APIはNativeWindクラス（bg-card等）と直接統合できないため、テーマ定数を直接参照 */
          backgroundColor: "#1a1a2e",
        }}
      />
    </View>
  );
}
