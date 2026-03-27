import { Text, View } from "react-native";

export default function SettingsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-2xl font-bold text-text">設定</Text>
      <Text className="mt-2 text-text-muted">アプリ設定</Text>
    </View>
  );
}
