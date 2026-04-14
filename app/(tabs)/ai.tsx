import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../../src/theme';
import { useApp } from '../../src/context/AppContext';
import { mockAIFeatures } from '../../src/mock/ai';

export default function AIScreen() {
  const router = useRouter();
  const { user } = useApp();

  const routeMap: Record<string, string> = {
    chat: '/chat',
    summarize: '/summarize',
    translate: '/translate',
    draft: '/draft',
  };

  const canAfford = (cost: number) => user.points >= cost;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>AIツール</Text>
          <View style={styles.balanceChip}>
            <Ionicons name="wallet" size={14} color={Colors.gold} />
            <Text style={styles.balanceText}>{user.points.toLocaleString()} pt</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          貯めたポイントを使ってAI機能を利用できます
        </Text>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={18} color={Colors.cyan} />
          <Text style={styles.infoText}>
            AI機能の利用にはポイントが必要です。ネットワーク参加でポイントを獲得しましょう。
          </Text>
        </View>

        {/* Feature cards */}
        <View style={styles.features}>
          {mockAIFeatures.map((feature) => {
            const affordable = canAfford(feature.pointCost);
            return (
              <TouchableOpacity
                key={feature.id}
                style={[
                  styles.featureCard,
                  !affordable && styles.featureCardDisabled,
                ]}
                onPress={() => router.push(routeMap[feature.id] as any)}
                activeOpacity={0.85}
              >
                {/* Icon */}
                <View style={[styles.featureIcon, { backgroundColor: `${feature.color}15` }]}>
                  <Ionicons name={feature.icon as any} size={32} color={feature.color} />
                </View>

                {/* Content */}
                <View style={styles.featureContent}>
                  <Text style={styles.featureName}>{feature.name}</Text>
                  <Text style={styles.featureDesc}>{feature.description}</Text>
                </View>

                {/* Cost & arrow */}
                <View style={styles.featureRight}>
                  <View style={[styles.costBadge, { backgroundColor: `${feature.color}15`, borderColor: `${feature.color}30` }]}>
                    <Ionicons name="flash" size={12} color={feature.color} />
                    <Text style={[styles.costText, { color: feature.color }]}>
                      {feature.pointCost} pt
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={affordable ? Colors.textSecondary : Colors.textMuted}
                    style={styles.arrow}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Total points info */}
        <View style={styles.pointsInfo}>
          <Text style={styles.pointsInfoTitle}>ポイントの使い方</Text>
          <View style={styles.pointsInfoRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.active} />
            <Text style={styles.pointsInfoText}>ネットワーク参加で毎日ポイント獲得</Text>
          </View>
          <View style={styles.pointsInfoRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.active} />
            <Text style={styles.pointsInfoText}>タスク完了でボーナスポイント</Text>
          </View>
          <View style={styles.pointsInfoRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.active} />
            <Text style={styles.pointsInfoText}>サポーターは毎月200ptボーナス</Text>
          </View>
        </View>

        <View style={{ height: Layout.tabBarHeight + 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingHorizontal: Layout.screenPadding, paddingTop: Spacing[4] },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[2],
  },
  title: { ...Typography.h2, color: Colors.textPrimary },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  balanceText: { ...Typography.label, color: Colors.gold },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing[4] },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0,210,255,0.07)',
    borderRadius: BorderRadius.md,
    padding: Spacing[3],
    gap: Spacing[2],
    marginBottom: Spacing[5],
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.15)',
  },
  infoText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  features: { gap: Spacing[3], marginBottom: Spacing[6] },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureCardDisabled: { opacity: 0.6 },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[4],
    flexShrink: 0,
  },
  featureContent: { flex: 1, marginRight: Spacing[3] },
  featureName: { ...Typography.h4, color: Colors.textPrimary, marginBottom: 4 },
  featureDesc: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 18 },
  featureRight: { alignItems: 'flex-end', gap: Spacing[2] },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
    borderWidth: 1,
  },
  costText: { fontSize: 12, fontWeight: '700' },
  arrow: { marginTop: Spacing[1] },
  pointsInfo: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing[3],
  },
  pointsInfoTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing[2] },
  pointsInfoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  pointsInfoText: { ...Typography.body, color: Colors.textSecondary },
});
