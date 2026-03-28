import { Tabs } from "expo-router";
import { Bell, Home, Search, Settings, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View, useColorScheme } from "react-native";

import { useUnreadNotificationCount } from "@/hooks/use-notifications";

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

/** 未読バッジの背景色 */
const BADGE_BG_COLOR = "#ef4444";

/** 未読バッジの最大表示数 */
const BADGE_MAX_COUNT = 99;

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark" || true;
  const { data: unreadCount } = useUnreadNotificationCount();

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
          title: t("tabs.home"),
          tabBarIcon: ({ color }) => <Home size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tabs.search"),
          tabBarIcon: ({ color }) => <Search size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tabs.notifications"),
          tabBarIcon: ({ color }) => (
            <View>
              <Bell size={TAB_ICON_SIZE} color={color} />
              {unreadCount != null && unreadCount > 0 && (
                <View
                  testID="tab-badge"
                  style={{ backgroundColor: BADGE_BG_COLOR }}
                  className="absolute -top-1 -right-2 rounded-full min-w-[16px] h-4 items-center justify-center px-1"
                >
                  <Text className="text-white text-[10px] font-bold">
                    {unreadCount > BADGE_MAX_COUNT ? `${BADGE_MAX_COUNT}+` : String(unreadCount)}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color }) => <User size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color }) => <Settings size={TAB_ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}
