import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { getRankColor, getNextRank } from '../../src/utils/format';
import { useRank } from '../../src/hooks/useRank';
import { USE_REAL_API } from '../../src/api/config';

const ranks = [
  { name: 'Bronze', minScore: 0, maxScore: 499, color: '#cd7f32', perks: ['毎日最大10pt獲得', '基本AIツール利用可能'] },
  { name: 'Silver', minScore: 500, maxScore: 999, color: '#c0c0c0', perks: ['毎日最大20pt獲得', '全AIツール利用可能', 'ランクアップボーナス50pt'] },
  { name: 'Gold', minScore: 1000, maxScore: 1999, color: '#ffd700', perks: ['毎日最大35pt獲得', 'AIツール割引10%', 'ランクアップボーナス100pt', '優先タスク割り当て'] },
  { name: 'Platinum', minScore: 2000, maxScore: 9999, color: '#e5e4e2', perks: ['毎日最大60pt獲得', 'AIツール割引20%', 'ランクアップボーナス200pt', '専用タスク割り当て', 'サポーター特典+20%'] },
];

const rankNextScores: Record<string, number> = {
  Bronze: 500, Silver: 1000, Gold: 2000, Platinum: 9999,
};
const rankPrevScores: Record<string, number> = {
  Bronze: 0, Silver: 500, Gold: 1000, Platinum: 2000,
};

export default function RankScreen() {
  const { user: mockUser } = useApp();
  const { data: rankData, isLoading } = useRank();

  // Merge mock and real data
  const rankName = USE_REAL_API && rankData ? rankData.rank : mockUser.rank;
  const score = USE_REAL_API && rankData ? rankData.score : mockUser.score;
  const nextScoreVal = USE_REAL_API && rankData
    ? rankData.next_rank_score
    : (rankNextScores[mockUser.rank] ?? 1000);
  const progressVal = USE_REAL_API && rankData ? rankData.progress : (() => {
    const prevScore = rankPrevScores[mockUser.rank] ?? 0;
    const nextS = rankNextScores[mockUser.rank] ?? 1000;
    return Math.round(((mockUser.score - prevScore) / (nextS - prevScore)) * 100);
  })();

  const remaining = nextScoreVal - score;
  const nextRank = getNextRank(rankName);

  const improvementHints = USE_REAL_API && rankData?.evaluation
    ? [
        `接続安定性: ${Math.round(rankData.evaluation.connection_stability)}% — Wi-Fiを安定させましょう`,
        `参加日数: ${rankData.evaluation.total_days}日 — 毎日参加でスコアアップ`,
        `連続参加: ${rankData.evaluation.consecutive_days}日 — 継続が大切です`,
      ]
    : [
        '毎日充電中にWi-Fi接続でネットワーク参加を続けましょう',
        '夜間の参加でより多くのタスクを処理できます',
        'サブノード候補に選ばれると追加ポイントが獲得できます',
      ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>貢献ランク</Text>

        {/* Current rank hero */}
        <View style={[styles.rankHero, { borderColor: `${getRankColor(rankName)}30` }]}>
          <View style={styles.rankHeroGlow} />
          <View style={[styles.rankTrophyWrapper, { backgroundColor: `${getRankColor(rankName)}15` }]}>
            {isLoading
              ? <ActivityIndicator color={getRankColor(rankName)} size="large" />
              : <Ionicons name="trophy" size={48} color={getRankColor(rankName)} />
            }
          </View>
          <Text style={[styles.rankHeroName, { color: getRankColor(rankName) }]}>
            {rankName}
          </Text>
          <Text style={styles.rankHeroScore}>{score} スコア</Text>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>{rankName}</Text>
              <Text style={[styles.progressLabel, { color: getRankColor(nextRank) }]}>{nextRank}</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, progressVal)}%`, backgroundColor: getRankColor(rankName) },
                ]}
              />
            </View>
            <View style={styles.progressStats}>
              <Text style={styles.progressText}>{progressVal}% 達成</Text>
              <Text style={styles.progressText}>
                あと{remaining}スコアで{nextRank}ランク
              </Text>
            </View>
          </View>
        </View>

        {/* Improvement hints */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>スコアアップのヒント</Text>
          <View style={styles.hints}>
            {improvementHints.map((hint, i) => (
              <View key={i} style={styles.hintRow}>
                <View style={styles.hintDot} />
                <Text style={styles.hintText}>{hint}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* All ranks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>全ランク一覧</Text>
          {ranks.map((rank) => {
            const isCurrent = rank.name === rankName;
            const isPast = score >= rank.maxScore;
            const rankColor = rank.color;
            return (
              <View
                key={rank.name}
                style={[
                  styles.rankItem,
                  isCurrent && styles.rankItemCurrent,
                  isCurrent && { borderColor: `${rankColor}40` },
                ]}
              >
                <View style={[styles.rankItemIcon, { backgroundColor: `${rankColor}15` }]}>
                  <Ionicons
                    name={isPast && !isCurrent ? 'checkmark-circle' : 'trophy'}
                    size={22}
                    color={isPast || isCurrent ? rankColor : Colors.textMuted}
                  />
                </View>
                <View style={styles.rankItemContent}>
                  <View style={styles.rankItemHeader}>
                    <Text style={[styles.rankItemName, { color: isCurrent ? rankColor : Colors.textSecondary }]}>
                      {rank.name}
                    </Text>
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: `${rankColor}20`, borderColor: `${rankColor}40` }]}>
                        <Text style={[styles.currentBadgeText, { color: rankColor }]}>現在</Text>
                      </View>
                    )}
                    <Text style={styles.rankRange}>{rank.minScore}〜{rank.maxScore === 9999 ? '∞' : rank.maxScore}</Text>
                  </View>
                  <View style={styles.rankPerks}>
                    {rank.perks.map((perk, i) => (
                      <Text key={i} style={[styles.perkText, isCurrent && styles.perkTextActive]}>
                        • {perk}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: Layout.tabBarHeight + 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing[4] },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing[5] },
  rankHero: {
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing[6],
    borderWidth: 1,
    marginBottom: Spacing[6],
    position: 'relative',
    overflow: 'hidden',
  },
  rankHeroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(192,192,192,0.04)',
    top: -50,
  },
  rankTrophyWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[3],
  },
  rankHeroName: { ...Typography.displayMedium, fontWeight: '800', marginBottom: Spacing[1] },
  rankHeroScore: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing[5] },
  progressSection: { width: '100%' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing[2] },
  progressLabel: { ...Typography.bodySmall, color: Colors.textSecondary, fontWeight: '600' },
  progressBar: { height: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: BorderRadius.full, overflow: 'hidden', marginBottom: Spacing[2] },
  progressFill: { height: '100%', borderRadius: BorderRadius.full },
  progressStats: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { ...Typography.caption, color: Colors.textMuted },
  section: { marginBottom: Spacing[6] },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing[4] },
  hints: { gap: Spacing[3], backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.border },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  hintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.cyan, marginTop: 7, flexShrink: 0 },
  hintText: { ...Typography.body, color: Colors.textSecondary, flex: 1, lineHeight: 22 },
  rankItem: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing[3] },
  rankItemCurrent: { backgroundColor: 'rgba(255,255,255,0.05)' },
  rankItemIcon: { width: 44, height: 44, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', marginRight: Spacing[3], flexShrink: 0 },
  rankItemContent: { flex: 1 },
  rankItemHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[2], flexWrap: 'wrap' },
  rankItemName: { ...Typography.h4, fontWeight: '700' },
  currentBadge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing[2], paddingVertical: 2, borderWidth: 1 },
  currentBadgeText: { fontSize: 11, fontWeight: '700' },
  rankRange: { ...Typography.caption, color: Colors.textMuted, marginLeft: 'auto' },
  rankPerks: { gap: Spacing[1] },
  perkText: { ...Typography.bodySmall, color: Colors.textMuted, lineHeight: 20 },
  perkTextActive: { color: Colors.textSecondary },
});
