import { Tabs } from "expo-router";
import { Home, Search, Settings, User } from "lucide-react-native";
import { useColorScheme } from "react-native";

/** タブバーのアクティブ色 */
const TAB_ACTIVE_COLOR = "#6366f1";

/** タブバーの非アクティブ色 */
const TAB_INACTIVE_COLOR = "#64748b";

/** ダークテーマの背景色 */
const DARK_BACKGROUND = "#0a0a0f";

/** ダークテーマのヘッダー背景色 */
const DARK_HEADER_BACKGROUND = "#13131a";

/** ダークテーマのボーダー色 */
const DARK_BORDER_COLOR = "#2d2d44";

/** ダークテーマのテキスト色 */
const DARK_TEXT_COLOR = "#e2e8f0";

/** タブアイコンサイズ */
const TAB_ICON_SIZE = 24;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark" || true;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TAB_ACTIVE_COLOR,
        tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: isDark ? DARK_HEADER_BACKGROUND : "#ffffff",
          borderTopColor: isDark ? DARK_BORDER_COLOR : "#e7e5e4",
        },
        headerStyle: {
          backgroundColor: isDark ? DARK_HEADER_BACKGROUND : "#ffffff",
        },
        headerTintColor: isDark ? DARK_TEXT_COLOR : "#1c1917",
        headerShadowVisible: false,
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "ホーム",
          tabBarIcon: ({ color }) => <Home size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "検索",
          tabBarIcon: ({ color }) => <Search size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "プロフィール",
          tabBarIcon: ({ color }) => <User size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "設定",
          tabBarIcon: ({ color }) => <Settings size={TAB_ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}
