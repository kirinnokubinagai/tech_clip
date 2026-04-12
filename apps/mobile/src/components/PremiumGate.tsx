import { Check, X } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

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
  const colors = useColors();

  return (
    <View
      testID="premium-gate-container"
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 24,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.text }}>
            プレミアムプラン
          </Text>
          <Pressable
            testID="close-button"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <X size={CLOSE_ICON_SIZE} color={colors.textMuted} />
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 4 }}>
            今月のAI機能使用回数
          </Text>
          <Text style={{ fontSize: 30, fontWeight: "bold", color: colors.text }}>
            {`${currentUsage} / ${maxUsage}`}
          </Text>
          {currentUsage >= maxUsage && (
            <Text style={{ fontSize: 14, color: colors.error, marginTop: 4 }}>
              無料プランの上限に達しました
            </Text>
          )}
        </View>

        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 12 }}>
          プレミアムプランで利用できる機能
        </Text>

        <ScrollView style={{ marginBottom: 24 }} showsVerticalScrollIndicator={false}>
          {features.map((feature) => (
            <View
              key={feature}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}
            >
              <Check size={CHECK_ICON_SIZE} color={colors.primary} />
              <Text style={{ fontSize: 14, color: colors.text, flex: 1 }}>{feature}</Text>
            </View>
          ))}
        </ScrollView>

        <Pressable
          testID="purchase-button"
          onPress={onPurchase}
          accessibilityRole="button"
          accessibilityLabel="プレミアムプランを購入する"
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.white }}>
            プレミアムプランを購入する
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
