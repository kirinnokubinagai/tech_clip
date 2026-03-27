import { StyleSheet, Text, View } from "react-native";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TechClip</Text>
      <Text style={styles.subtitle}>ログインしてください</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafaf9",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1c1917",
  },
  subtitle: {
    fontSize: 16,
    color: "#78716c",
    marginTop: 8,
  },
});
