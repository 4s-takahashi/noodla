import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { StatusCard } from '../../src/components/cards/StatusCard';
import { StatCard } from '../../src/components/cards/StatCard';
import { RankProgressCard } from '../../src/components/cards/RankProgressCard';
import { Badge } from '../../src/components/ui/Badge';
import { getStatusLabel } from '../../src/utils/format';
import { useAuthStore } from '../../src/stores/auth-store';
import { useNodeStore } from '../../src/stores/node-store';
import { useWsStore } from '../../src/stores/ws-store';
import { usePointsBalance } from '../../src/hooks/usePoints';
import { USE_REAL_API } from '../../src/api/config';

const { width } = Dimensions.get('window');

const rankNextScores: Record<string, number> = {
  Bronze: 500,
  Silver: 1000,
  Gold: 2000,
  Platinum: 9999,
};

export default function HomeScreen() {
  const router = useRouter();
  // Phase 1 context (mock fallback)
  const { user: mockUser, networkStatus: mockNetworkStatus, pointsData: mockPointsData, unreadCount: mockUnreadCount, toggleParticipation: mockToggle } = useApp();
  const scrollY = useRef(new Animated.Value(0)).current;

  // Real API data (when USE_REAL_API=true)
  const authUser = useAuthStore(s => s.user);
  const nodeStore = useNodeStore();
  const { data: balanceData } = usePointsBalance();

  // WebSocket state (Phase 5)
  const wsStore = useWsStore();
  const wsState = wsStore.connectionState;
  const wsNetworkStatus = wsStore.networkStatus;

  // Merge mock and real data
  const user = USE_REAL_API && authUser
    ? { ...mockUser, name: authUser.name, rank: authUser.rank as any, supporter: authUser.is_supporter }
    : mockUser;
  const networkStatus = USE_REAL_API
    ? { ...mockNetworkStatus, status: nodeStore.status, globalNodes: nodeStore.globalNodes, wifiConnected: nodeStore.wifiConnected, batteryLevel: nodeStore.batteryLevel }
    : mockNetworkStatus;
  const balance = USE_REAL_API && balanceData ? balanceData.balance : mockPointsData.balance;
  const todayPoints = USE_REAL_API && balanceData ? balanceData.today : mockPointsData.today;
  const unreadCount = mockUnreadCount; // TODO: connect to real notifications hook

  const toggleParticipation = USE_REAL_API
    ? () => {
        if (nodeStore.isParticipating) nodeStore.stopParticipation();
        else nodeStore.startParticipation();
      }
    : mockToggle;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nextScore = rankNextScores[user.rank] ?? 1000;

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating header on scroll */}
      <Animated.View style={[styles.floatingHeader, { opacity: headerOpacity }]}>
        <Text style={styles.floatingTitle}>Noodla</Text>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>こんにちは、</Text>
            <Text style={styles.userName}>{user.name}さん</Text>
          </View>
          <View style={styles.headerRight}>
            {user.supporter && (
              <Badge
                variant="supporter"
                label="サポーター"
                icon="star"
                size="sm"
                style={styles.supporterBadge}
              />
            )}
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={styles.notifBtn}
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.textSecondary} />
              {unreadCount > 0 && (
                <View style={styles.notifDot}>
                  <Text style={styles.notifDotText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── GLOBAL NODE COUNT (hero section) ── */}
        <View style={styles.heroSection}>
          <View style={styles.heroGlow} />

          {/* WebSocket 接続状態バッジ */}
          <View style={styles.wsStatusRow}>
            <View style={[
              styles.wsStatusDot,
              { backgroundColor:
                wsState === 'connected' ? Colors.active
                : wsState === 'connecting' || wsState === 'reconnecting' ? Colors.standby
                : Colors.error
              }
            ]} />
            <Text style={[
              styles.wsStatusText,
              { color:
                wsState === 'connected' ? Colors.active
                : wsState === 'connecting' || wsState === 'reconnecting' ? Colors.standby
                : Colors.textMuted
              }
            ]}>
              {wsState === 'connected' ? 'WS 接続中'
                : wsState === 'connecting' ? 'WS 接続中...'
                : wsState === 'reconnecting' ? 'WS 再接続中...'
                : 'WS 未接続'}
            </Text>
          </View>

          <View style={styles.globeRow}>
            <View style={styles.globeIconWrapper}>
              <Ionicons name="globe" size={36} color={Colors.cyan} />
              <View style={styles.globePulse1} />
              <View style={styles.globePulse2} />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.nodeCountHero}>
                {wsNetworkStatus
                  ? wsNetworkStatus.totalOnline.toLocaleString()
                  : networkStatus.globalNodes.toLocaleString()}
              </Text>
              <Text style={styles.nodeCountLabel}>nodes online</Text>
              {wsNetworkStatus && (
                <Text style={styles.nodeCountSub}>
                  参加中: {wsNetworkStatus.totalParticipating} 台
                </Text>
              )}
            </View>
          </View>

          {/* Status badge */}
          <View style={styles.statusRow}>
            <Badge
              variant={networkStatus.status as any}
              label={getStatusLabel(networkStatus.status)}
              icon={
                networkStatus.status === 'active'
                  ? 'radio-button-on'
                  : networkStatus.status === 'power_save'
                  ? 'battery-half'
                  : 'pause-circle'
              }
              size="lg"
            />
            {networkStatus.currentJob && networkStatus.status === 'active' && (
              <View style={styles.jobBadge}>
                <Ionicons name="hardware-chip" size={12} color={Colors.cyan} />
                <Text style={styles.jobText}>
                  {networkStatus.currentJob === 'text_analysis'
                    ? 'テキスト分析 処理中...'
                    : networkStatus.currentJob === 'image_processing'
                    ? '画像処理 処理中...'
                    : 'データ分類 処理中...'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── WS JOB STATS ── */}
        {wsStore.jobsProcessed > 0 && (
          <View style={styles.wsJobStats}>
            <Ionicons name="hardware-chip-outline" size={14} color={Colors.cyan} />
            <Text style={styles.wsJobStatsText}>
              最近のジョブ処理: {wsStore.jobsProcessed}件（採用: {wsStore.jobsAccepted}件）
              {wsStore.sessionPoints > 0 && `  +${wsStore.sessionPoints}pt獲得`}
            </Text>
          </View>
        )}

        {/* ── POINT STATS ── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="flash"
            iconColor={Colors.gold}
            value={`+${todayPoints} pt`}
            label="今日の獲得"
            accentColor={Colors.gold}
            onPress={() => router.push('/(tabs)/points')}
            style={styles.statCard}
          />
          <StatCard
            icon="wallet"
            iconColor={Colors.cyan}
            value={`${balance.toLocaleString()} pt`}
            label="残高"
            accentColor={Colors.cyan}
            onPress={() => router.push('/(tabs)/points')}
            style={styles.statCard}
          />
        </View>

        {/* ── RANK PROGRESS ── */}
        <TouchableOpacity onPress={() => router.push('/rank')} activeOpacity={0.9}>
          <RankProgressCard
            rank={user.rank}
            score={user.score}
            nextRankScore={nextScore}
          />
        </TouchableOpacity>

        {/* ── STATUS CARD ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>参加状況</Text>
          <TouchableOpacity onPress={() => router.push('/participation')}>
            <Text style={styles.sectionLink}>詳細 →</Text>
          </TouchableOpacity>
        </View>

        <StatusCard
          status={networkStatus.status}
          currentJob={networkStatus.currentJob}
          globalNodes={networkStatus.globalNodes}
          onToggle={toggleParticipation}
          onPress={() => router.push('/participation')}
        />

        {/* ── DEVICE STATS ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>デバイス情報</Text>
          <TouchableOpacity onPress={() => router.push('/connection')}>
            <Text style={styles.sectionLink}>接続詳細 →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon={networkStatus.wifiConnected ? 'wifi' : 'wifi-outline'}
            iconColor={networkStatus.wifiConnected ? Colors.active : Colors.textMuted}
            value={networkStatus.wifiConnected ? '接続中' : '未接続'}
            label="Wi-Fi"
            style={styles.statCard}
          />
          <StatCard
            icon={networkStatus.isCharging ? 'battery-charging' : 'battery-half'}
            iconColor={networkStatus.isCharging ? Colors.active : Colors.standby}
            value={`${networkStatus.batteryLevel}%`}
            label="バッテリー"
            sublabel={networkStatus.isCharging ? '充電中' : undefined}
            style={styles.statCard}
          />
        </View>

        {/* ── AI SHORTCUT ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AIツール</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/ai')}>
            <Text style={styles.sectionLink}>すべて見る →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.aiShortcuts}>
          {[
            { icon: 'chatbubbles', label: 'チャット', route: '/chat', color: Colors.cyan },
            { icon: 'document-text', label: '要約', route: '/summarize', color: Colors.purpleLight },
            { icon: 'language', label: '翻訳', route: '/translate', color: Colors.active },
            { icon: 'create', label: '生成', route: '/draft', color: Colors.standby },
          ].map(item => (
            <TouchableOpacity
              key={item.route}
              style={styles.aiShortcutBtn}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.aiShortcutIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={styles.aiShortcutLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── SUPPORTER BANNER (if not supporter) ── */}
        {!user.supporter && (
          <TouchableOpacity
            style={styles.supporterBanner}
            onPress={() => router.push('/supporter')}
            activeOpacity={0.9}
          >
            <View style={styles.supporterContent}>
              <Ionicons name="star" size={24} color={Colors.gold} />
              <View style={styles.supporterText}>
                <Text style={styles.supporterTitle}>サポーターになろう</Text>
                <Text style={styles.supporterBody}>月額 ¥100 で追加特典をゲット</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.gold} />
          </TouchableOpacity>
        )}

        <View style={{ height: Layout.tabBarHeight + 20 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(26,26,46,0.95)',
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: Layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  floatingTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing[4],
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing[6],
  },
  headerLeft: {},
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  greeting: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  userName: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  supporterBadge: {},
  notifBtn: {
    position: 'relative',
    padding: Spacing[1],
  },
  notifDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDotText: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },

  // Hero
  heroSection: {
    marginBottom: Spacing[5],
    backgroundColor: 'rgba(0,210,255,0.04)',
    borderRadius: BorderRadius.xl,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.12)',
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0,210,255,0.06)',
  },
  globeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  globeIconWrapper: {
    position: 'relative',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[4],
  },
  globePulse1: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.25)',
  },
  globePulse2: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.1)',
  },
  heroText: {},
  nodeCountHero: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 44,
  },
  nodeCountLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  nodeCountSub: {
    ...Typography.caption,
    color: Colors.cyan,
    marginTop: 2,
  },
  wsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[3],
  },
  wsStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  wsStatusText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  wsJobStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: 'rgba(0,210,255,0.06)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.1)',
  },
  wsJobStatsText: {
    ...Typography.caption,
    color: Colors.cyan,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    flexWrap: 'wrap',
  },
  jobBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,210,255,0.08)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: 5,
    gap: Spacing[1],
  },
  jobText: {
    ...Typography.caption,
    color: Colors.cyan,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  statCard: {
    flex: 1,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing[5],
    marginBottom: Spacing[3],
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  sectionLink: {
    ...Typography.bodySmall,
    color: Colors.cyan,
  },

  // AI shortcuts
  aiShortcuts: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  aiShortcutBtn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing[2],
  },
  aiShortcutIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiShortcutLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Supporter banner
  supporterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,215,0,0.07)',
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    marginTop: Spacing[4],
  },
  supporterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  supporterText: {},
  supporterTitle: {
    ...Typography.body,
    color: Colors.gold,
    fontWeight: '600',
  },
  supporterBody: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
