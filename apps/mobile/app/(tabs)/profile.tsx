import { Text, View } from "react-native";

export default function ProfileScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-2xl font-bold text-text">プロフィール</Text>
      <Text className="mt-2 text-text-muted">ユーザー情報</Text>
    </View>
  );
}
