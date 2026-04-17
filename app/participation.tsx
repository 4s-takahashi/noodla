import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { Badge } from '../src/components/ui/Badge';
import { StatCard } from '../src/components/cards/StatCard';
import { InfoCard } from '../src/components/cards/InfoCard';
import { getStatusLabel, getJobLabel, formatDuration } from '../src/utils/format';
import { useWsStore } from '../src/stores/ws-store';
import { useParticipationStats, formatUptimeMinutes, formatResponseMs } from '../src/hooks/useParticipationStats';
import { USE_REAL_API } from '../src/api/config';

export default function ParticipationScreen() {
  const router = useRouter();
  const { networkStatus, toggleParticipation } = useApp();

  // WebSocket state (Phase 5)
  const wsStore = useWsStore();
  const wsConnected = wsStore.connectionState === 'connected';
  const wsParticipating = wsStore.networkStatus !== null && wsStore.currentJob !== null;

  // Phase 6: 累積参加統計
  const { data: participationStats } = useParticipationStats();

  const handleJoinNetwork = () => {
    if (!wsConnected) {
      wsStore.connect();
    } else {
      wsStore.joinNetwork();
    }
  };

  const handleLeaveNetwork = () => {
    wsStore.leaveNetwork();
  };

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

        {/* WebSocket 参加コントロール (Phase 5) */}
        <View style={styles.wsCard}>
          <View style={styles.wsCardHeader}>
            <View style={styles.wsStatusIndicator}>
              <View style={[
                styles.wsStatusDot,
                {
                  backgroundColor:
                    wsStore.connectionState === 'connected' ? Colors.active
                    : wsStore.connectionState === 'reconnecting' || wsStore.connectionState === 'connecting' ? Colors.standby
                    : Colors.error
                }
              ]} />
              <Text style={styles.wsStatusLabel}>
                {wsStore.connectionState === 'connected' ? '接続中'
                  : wsStore.connectionState === 'connecting' ? '接続中...'
                  : wsStore.connectionState === 'reconnecting' ? '再接続中...'
                  : '未接続'}
              </Text>
            </View>
            <View style={styles.wsActions}>
              <TouchableOpacity
                style={[styles.wsBtn, styles.wsBtnJoin]}
                onPress={handleJoinNetwork}
              >
                <Ionicons name="play-circle" size={16} color={Colors.active} />
                <Text style={[styles.wsBtnText, { color: Colors.active }]}>参加する</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wsBtn, styles.wsBtnLeave]}
                onPress={handleLeaveNetwork}
              >
                <Ionicons name="stop-circle" size={16} color={Colors.error} />
                <Text style={[styles.wsBtnText, { color: Colors.error }]}>停止する</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ネットワーク状況 */}
          {wsStore.networkStatus && (
            <View style={styles.wsNetworkInfo}>
              <Text style={styles.wsNetworkInfoText}>
                オンライン: {wsStore.networkStatus.totalOnline}台 ／ 参加中: {wsStore.networkStatus.totalParticipating}台
              </Text>
            </View>
          )}

          {/* ジョブ処理中インジケーター */}
          {wsStore.currentJob && (
            <View style={styles.jobProcessing}>
              <ActivityIndicator size="small" color={Colors.cyan} />
              <Text style={styles.jobProcessingText}>ジョブ処理中...</Text>
            </View>
          )}

          {/* 統計 */}
          <View style={styles.wsStats}>
            <Text style={styles.wsStatsText}>
              処理: {wsStore.jobsProcessed}件 ／ 採用: {wsStore.jobsAccepted}件
            </Text>
            {wsStore.sessionPoints > 0 && (
              <Text style={styles.wsExpPoints}>
                セッション獲得: +{wsStore.sessionPoints}pt
              </Text>
            )}
          </View>
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

        {/* 直近のジョブ結果リスト */}
        {wsStore.recentJobResults.length > 0 && (
          <View style={styles.recentJobsSection}>
            <Text style={styles.recentJobsTitle}>直近のジョブ結果</Text>
            {wsStore.recentJobResults.slice(0, 5).map((result, idx) => (
              <View key={`${result.jobId}-${idx}`} style={styles.recentJobRow}>
                <View style={[
                  styles.recentJobDot,
                  {
                    backgroundColor: result.accepted ? Colors.active
                      : result.reason === 'timeout' ? Colors.standby
                      : Colors.error
                  }
                ]} />
                <Text style={styles.recentJobStatus}>
                  {result.accepted ? '✅ 採用'
                    : result.reason === 'timeout' ? '⏱ タイムアウト'
                    : '❌ 遅延'}
                </Text>
                <Text style={styles.recentJobId}>
                  {result.jobId.slice(0, 8)}...
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Phase 6: 累積参加統計 */}
        {participationStats && (
          <View style={styles.statsGrid}>
            <Text style={styles.statsSectionTitle}>累積統計</Text>
            <View style={styles.statsRow}>
              <StatCard
                icon="time"
                iconColor={Colors.cyan}
                value={formatUptimeMinutes(participationStats.today_uptime_minutes)}
                label="本日の参加時間"
                style={styles.statCard}
              />
              <StatCard
                icon="calendar"
                iconColor={Colors.purpleLight}
                value={formatUptimeMinutes(participationStats.total_uptime_minutes)}
                label="累積参加時間"
                style={styles.statCard}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                icon="checkmark-done"
                iconColor={Colors.active}
                value={`${participationStats.total_jobs_processed}件`}
                label="累積ジョブ数"
                style={styles.statCard}
              />
              <StatCard
                icon="flash"
                iconColor={Colors.standby}
                value={formatResponseMs(participationStats.avg_response_ms)}
                label="平均応答時間"
                style={styles.statCard}
              />
            </View>
          </View>
        )}

        {/* Stats grid (モックデータ) */}
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

  // WebSocket Card (Phase 5)
  wsCard: {
    backgroundColor: 'rgba(0,210,255,0.04)',
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.15)',
    marginBottom: Spacing[4],
    gap: Spacing[3],
  },
  wsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wsStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  wsStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  wsStatusLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  wsActions: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  wsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  wsBtnJoin: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.25)',
  },
  wsBtnLeave: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  wsBtnText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  wsNetworkInfo: {},
  wsNetworkInfoText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  jobProcessing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: 'rgba(0,210,255,0.08)',
    borderRadius: BorderRadius.sm,
    padding: Spacing[2],
  },
  jobProcessingText: {
    ...Typography.caption,
    color: Colors.cyan,
  },
  wsStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wsStatsText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  wsExpPoints: {
    ...Typography.caption,
    color: Colors.gold,
    fontWeight: '700',
  },

  // Recent jobs
  recentJobsSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing[4],
    gap: Spacing[2],
  },
  recentJobsTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: Spacing[2],
  },
  recentJobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[1],
  },
  recentJobDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  recentJobStatus: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
  },
  recentJobId: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },

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
  statsSectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing[2] },
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
