import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../src/theme';
import { Input, Button } from '../src/components/ui';
import { mockSummarizeResult } from '../src/mock/ai';

export default function SummarizeScreen() {
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const POINT_COST = 20;

  const handleSummarize = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setResult('');
    await new Promise(r => setTimeout(r, 2000));
    setResult(mockSummarizeResult);
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
            <Text style={styles.title}>文章要約</Text>
          </View>
          <View style={styles.costChip}>
            <Ionicons name="flash" size={12} color={Colors.purpleLight} />
            <Text style={[styles.costText, { color: Colors.purpleLight }]}>{POINT_COST}pt</Text>
          </View>
        </View>

        <View style={styles.iconHero}>
          <View style={styles.iconWrapper}>
            <Ionicons name="document-text" size={40} color={Colors.purpleLight} />
          </View>
          <Text style={styles.description}>
            要約したい文章を入力してください。Noodlaネットワークがスマートに要約します。
          </Text>
        </View>

        <Input
          label="要約するテキスト"
          value={inputText}
          onChangeText={setInputText}
          placeholder="ここに文章を貼り付けてください..."
          multiline
          numberOfLines={8}
        />

        <Button
          title={loading ? '処理中...' : '要約する'}
          onPress={handleSummarize}
          loading={loading}
          disabled={!inputText.trim()}
          variant="primary"
          size="lg"
          fullWidth
        />

        {loading && (
          <View style={styles.processingCard}>
            <ActivityIndicator color={Colors.purpleLight} />
            <Text style={styles.processingText}>ネットワーク処理中...</Text>
            <Text style={styles.processingSubtext}>分散AIが文章を分析しています</Text>
          </View>
        )}

        {result && !loading && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.active} />
              <Text style={styles.resultTitle}>要約完了</Text>
              <View style={styles.costUsed}>
                <Text style={styles.costUsedText}>-{POINT_COST}pt 使用</Text>
              </View>
            </View>
            <Text style={styles.resultText}>{result}</Text>
            <TouchableOpacity style={styles.copyBtn}>
              <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.copyText}>コピー</Text>
            </TouchableOpacity>
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
    backgroundColor: 'rgba(167,139,250,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[2], paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  costText: { fontSize: 11, fontWeight: '700' },
  iconHero: { alignItems: 'center', marginBottom: Spacing[6] },
  iconWrapper: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[4], borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
  },
  description: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  processingCard: {
    alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing[6], borderWidth: 1, borderColor: Colors.border, marginTop: Spacing[4], gap: Spacing[3],
  },
  processingText: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  processingSubtext: { ...Typography.bodySmall, color: Colors.textSecondary },
  resultCard: {
    backgroundColor: 'rgba(34,197,94,0.05)', borderRadius: BorderRadius.lg,
    padding: Spacing[5], borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', marginTop: Spacing[4],
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[4] },
  resultTitle: { ...Typography.h4, color: Colors.active, flex: 1 },
  costUsed: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing[2], paddingVertical: 2 },
  costUsedText: { fontSize: 11, color: Colors.error, fontWeight: '600' },
  resultText: { ...Typography.body, color: Colors.textPrimary, lineHeight: 26 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginTop: Spacing[4], alignSelf: 'flex-end' },
  copyText: { ...Typography.bodySmall, color: Colors.textSecondary },
});
