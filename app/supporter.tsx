import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { Button } from '../src/components/ui/Button';

const benefits = [
  { icon: 'flash', color: Colors.gold, title: '毎月 200pt ボーナス', desc: '毎月1日に自動的にポイントが付与されます' },
  { icon: 'trending-up', color: Colors.active, title: 'ポイント獲得量 +20%', desc: '参加ポイントが通常の1.2倍になります' },
  { icon: 'star', color: Colors.purpleLight, title: 'AI機能 10% 割引', desc: 'すべてのAI機能のポイント消費が10%減ります' },
  { icon: 'shield-checkmark', color: Colors.cyan, title: '優先サポート', desc: 'サポーター専用チャンネルでの優先対応' },
  { icon: 'trophy', color: Colors.goldRank, title: 'サポーターバッジ', desc: 'プロフィールに特別バッジが表示されます' },
];

export default function SupporterScreen() {
  const router = useRouter();
  const { user } = useApp();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>サポータープラン</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.starRing}>
            <Ionicons name="star" size={52} color={Colors.gold} />
          </View>
          {user.supporter ? (
            <>
              <Text style={styles.heroTitle}>サポーター会員です</Text>
              <Text style={styles.heroSubtitle}>いつもNoodlaをサポートしてくださり{'\n'}ありがとうございます！</Text>
              <View style={styles.supporterSince}>
                <Ionicons name="calendar" size={14} color={Colors.textMuted} />
                <Text style={styles.supporterSinceText}>2025年10月から加入中</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.heroTitle}>Noodlaをサポートしよう</Text>
              <Text style={styles.heroSubtitle}>月額わずか ¥100 でコミュニティを支援しながら{'\n'}特別な特典を受け取れます</Text>
              <View style={styles.priceTag}>
                <Text style={styles.priceSymbol}>¥</Text>
                <Text style={styles.priceAmount}>100</Text>
                <Text style={styles.pricePeriod}>/ 月</Text>
              </View>
            </>
          )}
        </View>

        {/* Benefits */}
        <Text style={styles.sectionTitle}>サポーター特典</Text>
        <View style={styles.benefits}>
          {benefits.map((benefit, i) => (
            <View key={i} style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: `${benefit.color}15` }]}>
                <Ionicons name={benefit.icon as any} size={22} color={benefit.color} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDesc}>{benefit.desc}</Text>
              </View>
              {user.supporter && (
                <Ionicons name="checkmark-circle" size={20} color={Colors.active} />
              )}
            </View>
          ))}
        </View>

        {/* Mission note */}
        <View style={styles.missionCard}>
          <Ionicons name="heart" size={20} color={Colors.error} />
          <Text style={styles.missionText}>
            サポーターの皆さまのご支援が、Noodlaネットワークの維持・改善・新機能開発を支えています。
            ご参加いただいているだけでもとても助かっています。サポーターはあくまで任意です。
          </Text>
        </View>

        {/* CTA */}
        {!user.supporter ? (
          <View style={styles.ctaSection}>
            <Button
              title="サポーターになる（¥100/月）"
              onPress={() => {}}
              variant="primary"
              size="lg"
              fullWidth
              style={styles.ctaBtn}
            />
            <Text style={styles.ctaNote}>
              いつでもキャンセル可能 · 自動更新 · 税込
            </Text>
          </View>
        ) : (
          <View style={styles.ctaSection}>
            <Button
              title="プランを管理する"
              onPress={() => {}}
              variant="secondary"
              size="lg"
              fullWidth
            />
          </View>
        )}
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
  hero: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.05)',
    borderRadius: BorderRadius.xl,
    padding: Spacing[7],
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    marginBottom: Spacing[6],
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,215,0,0.04)', top: -50 },
  starRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,215,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[4],
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.3)',
  },
  heroTitle: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing[3] },
  heroSubtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 26, marginBottom: Spacing[4] },
  supporterSince: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  supporterSinceText: { ...Typography.bodySmall, color: Colors.textMuted },
  priceTag: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  priceSymbol: { ...Typography.h3, color: Colors.gold, marginBottom: 6 },
  priceAmount: { fontSize: 56, fontWeight: '800', color: Colors.gold, lineHeight: 60 },
  pricePeriod: { ...Typography.body, color: Colors.textSecondary, marginBottom: 8 },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing[4] },
  benefits: { gap: Spacing[3], marginBottom: Spacing[5] },
  benefitItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing[4], borderWidth: 1, borderColor: Colors.border,
  },
  benefitIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  benefitContent: { flex: 1 },
  benefitTitle: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  benefitDesc: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 18 },
  missionCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: BorderRadius.lg,
    padding: Spacing[4], borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', marginBottom: Spacing[5],
  },
  missionText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, lineHeight: 22 },
  ctaSection: { gap: Spacing[3] },
  ctaBtn: {},
  ctaNote: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center' },
});
