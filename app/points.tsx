import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { PointHistoryRow } from '../src/components/cards/PointHistoryRow';

export default function PointsScreen() {
  const router = useRouter();
  const { pointsData } = useApp();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>ポイント履歴</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceGlow} />
          <Text style={styles.balanceLabel}>現在の残高</Text>
          <Text style={styles.balanceValue}>{pointsData.balance.toLocaleString()} pt</Text>
          <View style={styles.balanceStats}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatValue}>+{pointsData.today}</Text>
              <Text style={styles.balanceStatLabel}>今日</Text>
            </View>
            <View style={styles.balanceStatDivider} />
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatValue}>+{pointsData.week}</Text>
              <Text style={styles.balanceStatLabel}>今週</Text>
            </View>
            <View style={styles.balanceStatDivider} />
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatValue}>+{pointsData.month}</Text>
              <Text style={styles.balanceStatLabel}>今月</Text>
            </View>
          </View>
        </View>

        {/* Summary row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>総獲得ポイント</Text>
            <Text style={[styles.summaryValue, styles.earned]}>
              +{pointsData.totalEarned.toLocaleString()} pt
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>総使用ポイント</Text>
            <Text style={[styles.summaryValue, styles.spent]}>
              -{pointsData.totalSpent.toLocaleString()} pt
            </Text>
          </View>
        </View>

        {/* History */}
        <Text style={styles.historyTitle}>取引履歴</Text>
        <View style={styles.historyCard}>
          {pointsData.history.map((tx, i) => (
            <PointHistoryRow
              key={tx.id}
              transaction={tx}
              showDivider={i < pointsData.history.length - 1}
            />
          ))}
        </View>
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
  balanceCard: {
    backgroundColor: 'rgba(0,210,255,0.06)',
    borderRadius: BorderRadius.xl,
    padding: Spacing[6],
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.15)',
    alignItems: 'center',
    marginBottom: Spacing[4],
    position: 'relative',
    overflow: 'hidden',
  },
  balanceGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,210,255,0.05)',
    top: -60,
  },
  balanceLabel: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing[2] },
  balanceValue: { fontSize: 52, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing[5] },
  balanceStats: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-around' },
  balanceStat: { alignItems: 'center' },
  balanceStatValue: { ...Typography.h4, color: Colors.active, fontWeight: '700' },
  balanceStatLabel: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  balanceStatDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing[5],
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing[1] },
  summaryValue: { ...Typography.bodyLarge, fontWeight: '700' },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  earned: { color: Colors.active },
  spent: { color: Colors.error },
  historyTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing[3] },
  historyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
