import { Tabs } from "expo-router";
import { Bell, Home, Search, Settings, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, useColorScheme, View } from "react-native";

import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { DARK_COLORS, LIGHT_COLORS } from "@/lib/constants";

/** タブアイコンサイズ */
const TAB_ICON_SIZE = 24;

/** 未読バッジの背景色 */
const BADGE_BG_COLOR = DARK_COLORS.primary;

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
        tabBarActiveTintColor: DARK_COLORS.primary,
        tabBarInactiveTintColor: DARK_COLORS.textDim,
        tabBarStyle: {
          backgroundColor: isDark ? DARK_COLORS.surface : LIGHT_COLORS.card,
          borderTopColor: isDark ? DARK_COLORS.border : LIGHT_COLORS.border,
        },
        headerStyle: {
          backgroundColor: isDark ? DARK_COLORS.surface : LIGHT_COLORS.card,
        },
        headerTintColor: isDark ? DARK_COLORS.text : LIGHT_COLORS.text,
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
                  accessibilityLabel={`未読通知${unreadCount > BADGE_MAX_COUNT ? `${BADGE_MAX_COUNT}件以上` : `${unreadCount}件`}`}
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
