import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { Badge } from '../../src/components/ui/Badge';
import { getRankColor } from '../../src/utils/format';
import { useAuthStore } from '../../src/stores/auth-store';
import { useDevices } from '../../src/hooks/useDevices';
import { USE_REAL_API } from '../../src/api/config';

interface SettingRowProps {
  icon: string;
  iconColor?: string;
  label: string;
  value?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  destructive?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon, iconColor = Colors.cyan, label, value, toggle, toggleValue, onToggle, onPress, destructive,
}) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    disabled={toggle && !onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={[styles.settingIcon, { backgroundColor: destructive ? 'rgba(239,68,68,0.1)' : `${iconColor}15` }]}>
      <Ionicons name={icon as any} size={18} color={destructive ? Colors.error : iconColor} />
    </View>
    <Text style={[styles.settingLabel, destructive && styles.settingLabelDestructive]}>
      {label}
    </Text>
    <View style={styles.settingRight}>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      {toggle && (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: Colors.bgCardDark, true: 'rgba(0,210,255,0.4)' }}
          thumbColor={toggleValue ? Colors.cyan : Colors.textMuted}
        />
      )}
      {!toggle && onPress && (
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      )}
    </View>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const router = useRouter();
  const { user: mockUser, settings, updateSettings, logout: mockLogout } = useApp();
  const authStore = useAuthStore();
  const { data: devicesData } = useDevices();

  // Merge mock and real data
  const user = USE_REAL_API && authStore.user
    ? {
        ...mockUser,
        name: authStore.user.name,
        email: authStore.user.email,
        rank: authStore.user.rank as any,
        supporter: authStore.user.is_supporter,
        deviceName: devicesData?.items[0]?.device_name ?? mockUser.deviceName,
      }
    : mockUser;

  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしてもよろしいですか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            if (USE_REAL_API) {
              await authStore.logout();
            } else {
              mockLogout();
            }
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>設定</Text>

        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{user.name[0]}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={styles.userBadges}>
              <Badge
                variant="rank"
                label={user.rank}
                icon="trophy"
                size="sm"
                style={{ borderColor: `${getRankColor(user.rank)}40` }}
              />
              {user.supporter && (
                <Badge variant="supporter" label="サポーター" icon="star" size="sm" />
              )}
            </View>
          </View>
        </View>

        {/* Participation settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>参加設定</Text>
          <View style={styles.sectionCard}>
            <SettingRow
              icon="wifi"
              label="Wi-Fiのみで参加"
              toggle
              toggleValue={settings.wifiOnly}
              onToggle={(v) => updateSettings('wifiOnly', v)}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="battery-charging"
              label="充電中を優先"
              toggle
              toggleValue={settings.chargingPriority}
              onToggle={(v) => updateSettings('chargingPriority', v)}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="battery-half"
              label="省電力時は停止"
              toggle
              toggleValue={settings.powerSaveStop}
              onToggle={(v) => updateSettings('powerSaveStop', v)}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知</Text>
          <View style={styles.sectionCard}>
            <SettingRow
              icon="notifications"
              label="プッシュ通知"
              toggle
              toggleValue={settings.notifications}
              onToggle={(v) => updateSettings('notifications', v)}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="mail"
              label="通知履歴"
              onPress={() => router.push('/notifications')}
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント</Text>
          <View style={styles.sectionCard}>
            <SettingRow
              icon="star"
              iconColor={Colors.gold}
              label="サポータープラン"
              value={user.supporter ? '加入中' : '未加入'}
              onPress={() => router.push('/supporter')}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="wallet"
              label="ポイント履歴"
              onPress={() => router.push('/(tabs)/points')}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="phone-portrait"
              label="デバイス情報"
              value={user.deviceName}
              onPress={() => router.push('/connection')}
            />
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>サポート・法的事項</Text>
          <View style={styles.sectionCard}>
            <SettingRow icon="document-text" label="利用規約" onPress={() => {}} />
            <View style={styles.divider} />
            <SettingRow icon="shield-checkmark" label="プライバシーポリシー" onPress={() => {}} />
            <View style={styles.divider} />
            <SettingRow icon="help-circle" label="ヘルプ・お問い合わせ" onPress={() => {}} />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <SettingRow
              icon="log-out"
              label="ログアウト"
              onPress={handleLogout}
              destructive
            />
          </View>
        </View>

        <Text style={styles.version}>Noodla v1.0.0 · Phase 1 Prototype</Text>

        <View style={{ height: Layout.tabBarHeight + 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing[4] },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing[5] },
  userCard: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginBottom: Spacing[6],
    gap: Spacing[4],
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,210,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,210,255,0.3)',
    flexShrink: 0,
  },
  avatarInitial: { ...Typography.h2, color: Colors.cyan },
  userInfo: { flex: 1 },
  userName: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 2 },
  userEmail: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing[2] },
  userBadges: { flexDirection: 'row', gap: Spacing[2] },
  section: { marginBottom: Spacing[4] },
  sectionTitle: { ...Typography.label, color: Colors.textMuted, marginBottom: Spacing[2], paddingHorizontal: Spacing[1] },
  sectionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    minHeight: 54,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
    flexShrink: 0,
  },
  settingLabel: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  settingLabelDestructive: { color: Colors.error },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  settingValue: { ...Typography.bodySmall, color: Colors.textMuted },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: Spacing[4] + 34 + Spacing[3] },
  version: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing[4] },
});
