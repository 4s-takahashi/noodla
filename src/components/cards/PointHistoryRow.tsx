import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { PointTransaction } from '../../types/points';
import { formatDate, formatTime } from '../../utils/format';

interface PointHistoryRowProps {
  transaction: PointTransaction;
  showDivider?: boolean;
}

const categoryIcons: Record<string, string> = {
  participation: 'globe',
  task: 'checkmark-circle',
  bonus: 'gift',
  rank_bonus: 'trophy',
  ai_use: 'sparkles',
};

const categoryColors: Record<string, string> = {
  participation: Colors.cyan,
  task: Colors.active,
  bonus: Colors.gold,
  rank_bonus: Colors.gold,
  ai_use: Colors.purpleLight,
};

export const PointHistoryRow: React.FC<PointHistoryRowProps> = ({
  transaction,
  showDivider = true,
}) => {
  const isPositive = transaction.amount > 0;
  const category = transaction.category ?? 'participation';
  const iconName = categoryIcons[category] ?? 'star';
  const iconColor = categoryColors[category] ?? Colors.cyan;

  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={iconName as any} size={18} color={iconColor} />
        </View>
        <View style={styles.content}>
          <Text style={styles.description} numberOfLines={1}>
            {transaction.description}
          </Text>
          <Text style={styles.date}>
            {formatDate(transaction.date)} · {formatTime(transaction.date)}
          </Text>
        </View>
        <Text style={[styles.amount, isPositive ? styles.positive : styles.negative]}>
          {isPositive ? '+' : ''}{transaction.amount} pt
        </Text>
      </View>
      {showDivider && <View style={styles.divider} />}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[3],
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  content: {
    flex: 1,
    marginRight: Spacing[3],
  },
  description: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  date: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  amount: {
    ...Typography.bodyLarge,
    fontWeight: '700',
  },
  positive: {
    color: Colors.active,
  },
  negative: {
    color: Colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 52,
  },
});
