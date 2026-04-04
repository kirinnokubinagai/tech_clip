import { Check, X } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { UI_COLORS } from "@/lib/constants";

/** PremiumGateコンポーネントのprops */
export type PremiumGateProps = {
  /** 現在のAI機能使用回数 */
  currentUsage: number;
  /** 無料プランの最大使用回数 */
  maxUsage: number;
  /** プレミアムプランで利用可能な機能一覧 */
  features: string[];
  /** 購入ボタンタップ時のコールバック */
  onPurchase: () => void;
  /** 閉じるボタンタップ時のコールバック */
  onClose: () => void;
};

/** チェックアイコンのサイズ（px） */
const CHECK_ICON_SIZE = 16;

/** 閉じるアイコンのサイズ（px） */
const CLOSE_ICON_SIZE = 20;

/** プライマリカラー */
const COLOR_PRIMARY = UI_COLORS.primary;

/** テキストミュートカラー */
const COLOR_TEXT_MUTED = UI_COLORS.textMuted;

/** エラーカラー */
const COLOR_ERROR = UI_COLORS.error;

/** テキストカラー */
const COLOR_TEXT = UI_COLORS.text;

/** 背景カラー */
const COLOR_BACKGROUND = UI_COLORS.background;

/** サーフェスカラー */
const COLOR_SURFACE = UI_COLORS.surface;

/** カードカラー */
const COLOR_CARD = UI_COLORS.card;

/** ボーダーカラー */
const COLOR_BORDER = UI_COLORS.border;

/** ホワイト */
const COLOR_WHITE = UI_COLORS.white;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR_BACKGROUND,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: COLOR_SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLOR_TEXT,
  },
  closeButton: {
    padding: 4,
  },
  usageCard: {
    backgroundColor: COLOR_CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: "center",
  },
  usageLabel: {
    fontSize: 14,
    color: COLOR_TEXT_MUTED,
    marginBottom: 4,
  },
  usageCount: {
    fontSize: 30,
    fontWeight: "bold",
    color: COLOR_TEXT,
  },
  usageLimitMessage: {
    fontSize: 14,
    color: COLOR_ERROR,
    marginTop: 4,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLOR_TEXT,
    marginBottom: 12,
  },
  featuresList: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: COLOR_TEXT,
    flex: 1,
  },
  purchaseButton: {
    backgroundColor: COLOR_PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLOR_WHITE,
  },
});

/**
 * プレミアムプラン誘導UIコンポーネント
 *
 * AI機能の使用回数超過時に表示する。
 * プレミアム機能一覧、使用量、購入ボタンを含む。
 *
 * @param currentUsage - 現在の使用回数
 * @param maxUsage - 最大使用回数
 * @param features - プレミアム機能一覧
 * @param onPurchase - 購入ボタンタップ時のコールバック
 * @param onClose - 閉じるボタンタップ時のコールバック
 */
export function PremiumGate({
  currentUsage,
  maxUsage,
  features,
  onPurchase,
  onClose,
}: PremiumGateProps) {
  return (
    <View testID="premium-gate-container" style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>プレミアムプラン</Text>
          <Pressable
            testID="close-button"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            hitSlop={8}
            style={styles.closeButton}
          >
            <X size={CLOSE_ICON_SIZE} color={COLOR_TEXT_MUTED} />
          </Pressable>
        </View>

        <View style={styles.usageCard}>
          <Text style={styles.usageLabel}>今月のAI機能使用回数</Text>
          <Text style={styles.usageCount}>{`${currentUsage} / ${maxUsage}`}</Text>
          {currentUsage >= maxUsage && (
            <Text style={styles.usageLimitMessage}>無料プランの上限に達しました</Text>
          )}
        </View>

        <Text style={styles.featuresTitle}>プレミアムプランで利用できる機能</Text>

        <ScrollView style={styles.featuresList} showsVerticalScrollIndicator={false}>
          {features.map((feature) => (
            <View key={feature} style={styles.featureItem}>
              <Check size={CHECK_ICON_SIZE} color={COLOR_PRIMARY} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </ScrollView>

        <Pressable
          testID="purchase-button"
          onPress={onPurchase}
          accessibilityRole="button"
          accessibilityLabel="プレミアムプランを購入する"
          style={styles.purchaseButton}
        >
          <Text style={styles.purchaseButtonText}>プレミアムプランを購入する</Text>
        </Pressable>
      </View>
    </View>
  );
}
