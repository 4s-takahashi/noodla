import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../src/theme';
import { mockConnectionInfo } from '../src/mock/network';
import { useWsStore } from '../src/stores/ws-store';

const strengthLabel: Record<string, string> = {
  excellent: '非常に良好', good: '良好', fair: '普通', poor: '弱い',
};
const strengthColor: Record<string, string> = {
  excellent: Colors.active, good: '#86efac', fair: Colors.standby, poor: Colors.error,
};

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(from: Date | null): string {
  if (!from) return '—';
  const seconds = Math.floor((Date.now() - from.getTime()) / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  return `${hours}時間${minutes % 60}分`;
}

export default function ConnectionScreen() {
  const router = useRouter();
  const conn = mockConnectionInfo;
  const wsStore = useWsStore();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>接続詳細</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Wi-Fi status */}
        <View style={styles.wifiCard}>
          <View style={styles.wifiHeader}>
            <View style={[styles.wifiIcon, { backgroundColor: conn.isConnected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }]}>
              <Ionicons name={conn.isConnected ? 'wifi' : 'wifi-outline'} size={32} color={conn.isConnected ? Colors.active : Colors.error} />
            </View>
            <View style={styles.wifiInfo}>
              <Text style={styles.wifiName}>{conn.wifiName}</Text>
              <Text style={[styles.wifiStrength, { color: strengthColor[conn.wifiStrength] }]}>
                {strengthLabel[conn.wifiStrength]}
              </Text>
              <Text style={styles.wifiStatus}>
                {conn.isConnected ? '接続中' : '未接続'}
              </Text>
            </View>
            {/* Signal bars visual */}
            <View style={styles.signalBars}>
              {[1, 2, 3, 4].map(level => (
                <View
                  key={level}
                  style={[
                    styles.signalBar,
                    { height: level * 6 + 4 },
                    level <= (conn.wifiStrength === 'excellent' ? 4 : conn.wifiStrength === 'good' ? 3 : conn.wifiStrength === 'fair' ? 2 : 1)
                      ? { backgroundColor: strengthColor[conn.wifiStrength] }
                      : { backgroundColor: Colors.border },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {[
            { label: '安定性', value: `${conn.stability}%`, icon: 'pulse', color: Colors.active },
            { label: '再接続回数', value: `${conn.reconnectCount}回`, icon: 'refresh', color: Colors.standby },
            { label: '参加資格', value: conn.participationEligible ? '対象' : '対象外', icon: 'shield-checkmark', color: conn.participationEligible ? Colors.active : Colors.error },
            { label: '最終接続', value: '今日 08:15', icon: 'time', color: Colors.cyan },
          ].map(item => (
            <View key={item.label} style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Eligibility */}
        {!conn.participationEligible && conn.ineligibilityReason && (
          <View style={styles.ineligibleBanner}>
            <Ionicons name="warning" size={18} color={Colors.standby} />
            <Text style={styles.ineligibleText}>{conn.ineligibilityReason}</Text>
          </View>
        )}

        {/* WebSocket 接続情報 (Phase 5) */}
        <View style={styles.wsCard}>
          <Text style={styles.wsCardTitle}>WebSocket 接続状態</Text>
          <View style={styles.wsInfoGrid}>
            {[
              {
                label: '接続状態',
                value: wsStore.connectionState === 'connected' ? '🟢 接続中'
                  : wsStore.connectionState === 'connecting' ? '🟡 接続中...'
                  : wsStore.connectionState === 'reconnecting' ? '🟡 再接続中...'
                  : '🔴 未接続',
              },
              {
                label: '接続先',
                value: wsStore.serverUrl || '—',
              },
              {
                label: '接続時間',
                value: formatDuration(wsStore.connectedAt),
              },
              {
                label: '最終heartbeat',
                value: formatDate(wsStore.lastHeartbeatAt),
              },
              {
                label: '再接続回数',
                value: `${wsStore.reconnectCount}回`,
              },
            ].map(item => (
              <View key={item.label} style={styles.wsInfoRow}>
                <Text style={styles.wsInfoLabel}>{item.label}</Text>
                <Text style={styles.wsInfoValue} numberOfLines={1}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Improvement hints */}
        <View style={styles.hintsCard}>
          <Text style={styles.hintsTitle}>改善のヒント</Text>
          {conn.improvementHints.map((hint, i) => (
            <View key={i} style={styles.hintRow}>
              <View style={styles.hintDot} />
              <Text style={styles.hintText}>{hint}</Text>
            </View>
          ))}
        </View>
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
  wifiCard: { backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg, padding: Spacing[5], borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing[4] },
  wifiHeader: { flexDirection: 'row', alignItems: 'center' },
  wifiIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginRight: Spacing[4] },
  wifiInfo: { flex: 1 },
  wifiName: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 2 },
  wifiStrength: { ...Typography.bodySmall, fontWeight: '600', marginBottom: 2 },
  wifiStatus: { ...Typography.caption, color: Colors.textMuted },
  signalBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  signalBar: { width: 6, borderRadius: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3], marginBottom: Spacing[4] },
  statItem: { width: '47%', backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.border, alignItems: 'flex-start' },
  statIcon: { width: 40, height: 40, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[2] },
  statValue: { ...Typography.h4, fontWeight: '700', marginBottom: 2 },
  statLabel: { ...Typography.caption, color: Colors.textMuted },
  ineligibleBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: BorderRadius.md, padding: Spacing[4], borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', marginBottom: Spacing[4] },
  ineligibleText: { ...Typography.bodySmall, color: Colors.standby, flex: 1, lineHeight: 20 },
  hintsCard: { backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg, padding: Spacing[5], borderWidth: 1, borderColor: Colors.border, gap: Spacing[3] },
  hintsTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing[2] },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  hintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.cyan, marginTop: 7, flexShrink: 0 },
  hintText: { ...Typography.body, color: Colors.textSecondary, flex: 1, lineHeight: 22 },

  // WebSocket card
  wsCard: {
    backgroundColor: 'rgba(0,210,255,0.04)',
    borderRadius: BorderRadius.lg,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.15)',
    marginBottom: Spacing[4],
    gap: Spacing[3],
  },
  wsCardTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  wsInfoGrid: {
    gap: Spacing[2],
  },
  wsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  wsInfoLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  wsInfoValue: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    textAlign: 'right',
    marginLeft: Spacing[3],
  },
});
