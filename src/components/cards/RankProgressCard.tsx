import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { getRankColor, getNextRank, getRankProgress } from '../../utils/format';
import { RankLevel } from '../../types/user';

interface RankProgressCardProps {
  rank: RankLevel;
  score: number;
  nextRankScore: number;
  prevRankScore?: number;
  compact?: boolean;
}

const rankPrevScores: Record<RankLevel, number> = {
  Bronze: 0,
  Silver: 500,
  Gold: 1000,
  Platinum: 2000,
};

export const RankProgressCard: React.FC<RankProgressCardProps> = ({
  rank,
  score,
  nextRankScore,
  prevRankScore,
  compact = false,
}) => {
  const rankColor = getRankColor(rank);
  const nextRank = getNextRank(rank);
  const prev = prevRankScore ?? rankPrevScores[rank];
  const progress = getRankProgress(score, nextRankScore, prev);
  const remaining = nextRankScore - score;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {!compact && (
        <View style={styles.header}>
          <View style={styles.rankIconContainer}>
            <Ionicons name="trophy" size={24} color={rankColor} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.rankLabel}>現在のランク</Text>
            <Text style={[styles.rankName, { color: rankColor }]}>{rank}</Text>
          </View>
          <View style={styles.nextRankContainer}>
            <Text style={styles.nextRankLabel}>次のランク</Text>
            <Text style={[styles.nextRankName, { color: getRankColor(nextRank) }]}>
              {nextRank}
            </Text>
          </View>
        </View>
      )}

      {compact && (
        <View style={styles.compactHeader}>
          <Ionicons name="trophy" size={18} color={rankColor} />
          <Text style={[styles.rankNameCompact, { color: rankColor }]}>{rank}</Text>
          <Text style={styles.arrowText}> → </Text>
          <Text style={[styles.rankNameCompact, { color: getRankColor(nextRank) }]}>
            {nextRank}
          </Text>
        </View>
      )}

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: rankColor },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: rankColor }]}>{progress}%</Text>
      </View>

      {!compact && (
        <View style={styles.footer}>
          <Text style={styles.scoreText}>
            現在: <Text style={{ color: Colors.textPrimary }}>{score} pt</Text>
          </Text>
          <Text style={styles.remainingText}>
            あと <Text style={{ color: rankColor }}>{remaining} pt</Text> で{nextRank}ランク
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardCompact: {
    padding: Spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  rankIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgCardDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  headerText: {
    flex: 1,
  },
  rankLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  rankName: {
    ...Typography.h3,
    fontWeight: '700',
  },
  nextRankContainer: {
    alignItems: 'flex-end',
  },
  nextRankLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  nextRankName: {
    ...Typography.bodyLarge,
    fontWeight: '600',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  rankNameCompact: {
    ...Typography.bodySmall,
    fontWeight: '700',
    marginLeft: Spacing[1],
  },
  arrowText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  progressText: {
    ...Typography.label,
    minWidth: 36,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing[3],
  },
  scoreText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  remainingText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
});
