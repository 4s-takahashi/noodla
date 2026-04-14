import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { Badge } from '../src/components/ui/Badge';
import { StatCard } from '../src/components/cards/StatCard';
import { InfoCard } from '../src/components/cards/InfoCard';
import { getStatusLabel, getJobLabel, formatDuration } from '../src/utils/format';

export default function ParticipationScreen() {
  const router = useRouter();
  const { networkStatus, toggleParticipation } = useApp();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>参加状況</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <Badge
              variant={networkStatus.status as any}
              label={getStatusLabel(networkStatus.status)}
              icon="radio-button-on"
              size="lg"
            />
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                networkStatus.status === 'active' && styles.toggleBtnStop,
              ]}
              onPress={toggleParticipation}
            >
              <Ionicons
                name={networkStatus.status === 'active' ? 'stop-circle' : 'play-circle'}
                size={18}
                color={networkStatus.status === 'active' ? Colors.error : Colors.active}
              />
              <Text style={[
                styles.toggleBtnText,
                networkStatus.status === 'active' && styles.toggleBtnTextStop,
              ]}>
                {networkStatus.status === 'active' ? '参加を停止' : '参加を開始'}
              </Text>
            </TouchableOpacity>
          </View>

          {networkStatus.currentJob && (
            <View style={styles.currentJob}>
              <Ionicons name="hardware-chip" size={16} color={Colors.cyan} />
              <Text style={styles.currentJobText}>
                現在のタスク: {getJobLabel(networkStatus.currentJob)}
              </Text>
            </View>
          )}
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              icon="time"
              iconColor={Colors.cyan}
              value={formatDuration(networkStatus.todayParticipationTime)}
              label="今日の参加時間"
              style={styles.statCard}
            />
            <StatCard
              icon="trending-up"
              iconColor={Colors.purpleLight}
              value={formatDuration(networkStatus.avgParticipationTime)}
              label="平均参加時間"
              style={styles.statCard}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              icon="checkmark-done"
              iconColor={Colors.active}
              value={`${networkStatus.recentSuccessCount}件`}
              label="最近の成功数"
              style={styles.statCard}
            />
            <StatCard
              icon="pulse"
              iconColor={Colors.standby}
              value={`${networkStatus.stability}%`}
              label="安定性"
              style={styles.statCard}
            />
          </View>
        </View>

        {/* Sub-node candidate */}
        {networkStatus.subNodeCandidate && (
          <InfoCard
            icon="globe"
            iconColor={Colors.gold}
            title="サブノード候補に選出されています"
            body="高い参加率と安定性が認められました。引き続き安定した参加でネットワークに貢献しましょう。追加ポイントが付与されます。"
            variant="highlight"
            style={styles.infoCard}
          />
        )}

        {/* Connection link */}
        <TouchableOpacity
          style={styles.connectionLink}
          onPress={() => router.push('/connection')}
          activeOpacity={0.8}
        >
          <View style={styles.connectionLinkContent}>
            <Ionicons name="wifi" size={20} color={Colors.cyan} />
            <View style={styles.connectionLinkText}>
              <Text style={styles.connectionLinkTitle}>接続詳細</Text>
              <Text style={styles.connectionLinkDesc}>
                Wi-Fi: {networkStatus.wifiName} · 安定性 {networkStatus.stability}%
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Info cards */}
        <InfoCard
          icon="information-circle"
          iconColor={Colors.cyan}
          title="参加条件について"
          body="Wi-Fi接続・充電中・バッテリー20%以上の条件を満たすと自動的にネットワークに参加します。設定から条件を変更できます。"
          style={styles.infoCard}
        />

        <InfoCard
          icon="shield-checkmark"
          iconColor={Colors.active}
          title="プライバシーについて"
          body="Noodlaはデバイス上のデータにアクセスしません。処理されるのは匿名化されたAIタスクのみです。"
          variant="success"
          style={styles.infoCard}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing[8] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing[4],
  },
  backBtn: { padding: Spacing[1] },
  title: { ...Typography.h3, color: Colors.textPrimary },
  statusCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing[4],
  },
  statusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[3] },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  toggleBtnStop: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  toggleBtnText: { ...Typography.label, color: Colors.active },
  toggleBtnTextStop: { color: Colors.error },
  currentJob: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  currentJobText: { ...Typography.bodySmall, color: Colors.cyan },
  statsGrid: { gap: Spacing[3], marginBottom: Spacing[4] },
  statsRow: { flexDirection: 'row', gap: Spacing[3] },
  statCard: { flex: 1 },
  infoCard: { marginBottom: Spacing[3] },
  connectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing[3],
  },
  connectionLinkContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  connectionLinkText: {},
  connectionLinkTitle: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  connectionLinkDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
});
