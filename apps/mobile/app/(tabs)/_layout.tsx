import { Tabs } from "expo-router";
import { Bell, Home, Search, Settings, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";

/** タブアイコンサイズ */
const TAB_ICON_SIZE = 24;

/** 未読バッジの最大表示数 */
const BADGE_MAX_COUNT = 99;

export default function TabLayout() {
  const { t } = useTranslation();
  const colors = useColors();
  const { data: unreadCount } = useUnreadNotificationCount();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
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
                  style={{ backgroundColor: colors.favorite }}
                  className="absolute -top-1 -right-2 rounded-full min-w-[16px] h-4 items-center justify-center px-1"
                  accessibilityLabel={
                    unreadCount > BADGE_MAX_COUNT
                      ? t("notifications.unreadBadgeLabelOver", { max: BADGE_MAX_COUNT })
                      : t("notifications.unreadBadgeLabel", { count: unreadCount })
                  }
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
