import { Tabs } from 'expo-router';
import { StyleSheet, View, ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

function TabIcon({
  name,
  nameFocused,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  nameFocused: React.ComponentProps<typeof Ionicons>['name'];
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <View style={styles.iconWrap}>
      {focused && <View style={styles.activeBg} />}
      <Ionicons
        name={focused ? nameFocused : name}
        color={focused ? colors.accent : color}
        size={21}
      />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hisseler',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="stats-chart-outline" nameFocused="stats-chart" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="picks"
        options={{
          title: 'Firsatlar',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="flash-outline" nameFocused="flash" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Takip',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="star-outline" nameFocused="star" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alarm',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="notifications-outline" nameFocused="notifications" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'Haber',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="newspaper-outline" nameFocused="newspaper" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Geçmiş',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="time-outline" nameFocused="time" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 8,
    height: 64,
    elevation: 12,
  },
  tabItem: {
    paddingVertical: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 28,
  },
  activeBg: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    bottom: 0,
    borderRadius: 10,
    backgroundColor: colors.blueSoft,
  },
});