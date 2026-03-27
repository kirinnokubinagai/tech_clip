import { Text, View } from "react-native";

export default function SearchScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-2xl font-bold text-text">検索</Text>
      <Text className="mt-2 text-text-muted">記事を検索</Text>
    </View>
  );
}
