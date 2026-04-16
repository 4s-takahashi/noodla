import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { formatDate } from '../src/utils/format';
import { useNotifications, useMarkNotificationRead } from '../src/hooks/useNotifications';
import { USE_REAL_API } from '../src/api/config';

const typeColors: Record<string, string> = {
  rank_up: Colors.gold,
  points: Colors.active,
  maintenance: Colors.standby,
  admin: Colors.cyan,
  milestone: Colors.purpleLight,
  system: Colors.cyan,
};

const typeIcons: Record<string, string> = {
  rank_up: 'trophy',
  points: 'star',
  maintenance: 'construct',
  admin: 'information-circle',
  milestone: 'flame',
  system: 'notifications',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications: mockNotifications, markNotificationRead: mockMarkRead } = useApp();
  const { data: apiNotifData, isLoading } = useNotifications();
  const markReadMutation = useMarkNotificationRead();

  // Unified notification list
  const notifications = USE_REAL_API && apiNotifData
    ? apiNotifData.items.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        date: n.created_at,
        read: n.is_read,
        icon: typeIcons[n.type] ?? 'notifications',
      }))
    : mockNotifications;

  const handleMarkRead = (id: string) => {
    if (USE_REAL_API) {
      markReadMutation.mutate(id);
    } else {
      mockMarkRead(id);
    }
  };

  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);

  const renderNotif = (notif: typeof notifications[0]) => {
    const color = typeColors[notif.type] ?? Colors.cyan;
    return (
      <TouchableOpacity
        key={notif.id}
        style={[styles.notifItem, !notif.read && styles.notifUnread]}
        onPress={() => handleMarkRead(notif.id)}
        activeOpacity={0.8}
      >
        <View style={[styles.notifIconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name={notif.icon as any} size={20} color={color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle}>{notif.title}</Text>
            {!notif.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifBody} numberOfLines={3}>{notif.body}</Text>
          <Text style={styles.notifDate}>{formatDate(notif.date)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (USE_REAL_API && isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.cyan} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>通知</Text>
          <View style={{ width: 40 }} />
        </View>

        {unread.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>未読 ({unread.length})</Text>
            <View style={styles.notifList}>
              {unread.map(renderNotif)}
            </View>
          </View>
        )}

        {read.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>既読</Text>
            <View style={styles.notifList}>
              {read.map(renderNotif)}
            </View>
          </View>
        )}

        {notifications.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>通知はありません</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing[8] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing[4] },
  backBtn: { padding: Spacing[1] },
  title: { ...Typography.h3, color: Colors.textPrimary },
  section: { marginBottom: Spacing[5] },
  sectionTitle: { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing[3] },
  notifList: { backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  notifItem: { flexDirection: 'row', padding: Spacing[4], borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  notifUnread: { backgroundColor: 'rgba(0,210,255,0.04)' },
  notifIconContainer: { width: 44, height: 44, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', marginRight: Spacing[3], flexShrink: 0 },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  notifTitle: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.cyan, marginLeft: Spacing[2] },
  notifBody: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing[2] },
  notifDate: { ...Typography.caption, color: Colors.textMuted },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing[16] },
  emptyText: { ...Typography.body, color: Colors.textMuted, marginTop: Spacing[4] },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
