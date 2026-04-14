import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';

interface TabIconProps {
  name: string;
  color: string;
  focused: boolean;
  label: string;
  badge?: number;
}

const TabIcon: React.FC<TabIconProps> = ({ name, color, focused, label, badge }) => (
  <View style={styles.tabItem}>
    <View style={styles.iconContainer}>
      <Ionicons name={name as any} size={24} color={color} />
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </View>
    <Text style={[styles.tabLabel, { color }]}>{label}</Text>
  </View>
);

export default function TabsLayout() {
  const { unreadCount } = useApp();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.cyan,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'home' : 'home-outline'}
              color={color}
              focused={focused}
              label="ホーム"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="points"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'wallet' : 'wallet-outline'}
              color={color}
              focused={focused}
              label="ポイント"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'sparkles' : 'sparkles-outline'}
              color={color}
              focused={focused}
              label="AI"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rank"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'trophy' : 'trophy-outline'}
              color={color}
              focused={focused}
              label="ランク"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'settings' : 'settings-outline'}
              color={color}
              focused={focused}
              label="設定"
              badge={unreadCount}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(22,33,62,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    height: 80,
    paddingBottom: 16,
    paddingTop: 10,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
