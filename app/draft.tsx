import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../src/theme';
import { Input, Button } from '../src/components/ui';
import { mockDraftResult } from '../src/mock/ai';

const TONES = ['丁寧', 'カジュアル', 'プロフェッショナル', 'フレンドリー', '簡潔'];

export default function DraftScreen() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [selectedTone, setSelectedTone] = useState('丁寧');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const POINT_COST = 25;

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setResult('');
    await new Promise(r => setTimeout(r, 2200));
    setResult(mockDraftResult);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>文章生成</Text>
          </View>
          <View style={styles.costChip}>
            <Ionicons name="flash" size={12} color={Colors.standby} />
            <Text style={[styles.costText, { color: Colors.standby }]}>{POINT_COST}pt</Text>
          </View>
        </View>

        <View style={styles.iconHero}>
          <View style={styles.iconWrapper}>
            <Ionicons name="create" size={40} color={Colors.standby} />
          </View>
          <Text style={styles.description}>
            テーマとトーンを指定するだけで、Noodlaネットワークが最適な文章を生成します。
          </Text>
        </View>

        <Input
          label="テーマ・目的"
          value={topic}
          onChangeText={setTopic}
          placeholder="例：新サービスの紹介メール、商品レビュー、など"
          multiline
          numberOfLines={3}
        />

        <View style={styles.toneSection}>
          <Text style={styles.toneLabel}>文章のトーン</Text>
          <View style={styles.toneChips}>
            {TONES.map(tone => (
              <TouchableOpacity
                key={tone}
                style={[styles.toneChip, selectedTone === tone && styles.toneChipActive]}
                onPress={() => setSelectedTone(tone)}
              >
                <Text style={[styles.toneChipText, selectedTone === tone && styles.toneChipTextActive]}>
                  {tone}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button
          title={loading ? '生成中...' : '文章を生成する'}
          onPress={handleGenerate}
          loading={loading}
          disabled={!topic.trim()}
          variant="primary"
          size="lg"
          fullWidth
        />

        {loading && (
          <View style={styles.processingCard}>
            <ActivityIndicator color={Colors.standby} />
            <Text style={styles.processingText}>文章生成中...</Text>
            <Text style={styles.processingSubtext}>ネットワークが最適な表現を検索しています</Text>
          </View>
        )}

        {result && !loading && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.active} />
              <Text style={styles.resultTitle}>生成完了</Text>
              <View style={styles.toneTag}>
                <Text style={styles.toneTagText}>{selectedTone}</Text>
              </View>
            </View>
            <Text style={styles.resultText}>{result}</Text>
            <View style={styles.resultActions}>
              <TouchableOpacity style={styles.actionBtn}>
                <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.actionText}>コピー</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleGenerate}>
                <Ionicons name="refresh" size={16} color={Colors.cyan} />
                <Text style={[styles.actionText, { color: Colors.cyan }]}>再生成</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingHorizontal: Layout.screenPadding, paddingBottom: Spacing[8] },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[4], gap: Spacing[3] },
  backBtn: { padding: Spacing[1] },
  headerCenter: { flex: 1 },
  title: { ...Typography.h3, color: Colors.textPrimary },
  costChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[2], paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },
  costText: { fontSize: 11, fontWeight: '700' },
  iconHero: { alignItems: 'center', marginBottom: Spacing[6] },
  iconWrapper: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[4], borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  description: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  toneSection: { marginBottom: Spacing[5] },
  toneLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing[3] },
  toneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  toneChip: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
    borderWidth: 1, borderColor: Colors.border,
  },
  toneChipActive: { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)' },
  toneChipText: { ...Typography.bodySmall, color: Colors.textSecondary },
  toneChipTextActive: { color: Colors.standby, fontWeight: '600' },
  processingCard: {
    alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing[6], borderWidth: 1, borderColor: Colors.border, marginTop: Spacing[4], gap: Spacing[3],
  },
  processingText: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  processingSubtext: { ...Typography.bodySmall, color: Colors.textSecondary },
  resultCard: {
    backgroundColor: 'rgba(245,158,11,0.05)', borderRadius: BorderRadius.lg,
    padding: Spacing[5], borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', marginTop: Spacing[4],
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[4] },
  resultTitle: { ...Typography.h4, color: Colors.standby, flex: 1 },
  toneTag: {
    backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[2], paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  toneTagText: { fontSize: 11, color: Colors.standby, fontWeight: '600' },
  resultText: { ...Typography.body, color: Colors.textPrimary, lineHeight: 28 },
  resultActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing[4], marginTop: Spacing[4] },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  actionText: { ...Typography.bodySmall, color: Colors.textSecondary },
});
