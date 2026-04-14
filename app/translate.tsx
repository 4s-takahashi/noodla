import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Layout } from '../src/theme';
import { Input, Button } from '../src/components/ui';
import { mockTranslateResult } from '../src/mock/ai';

const LANGUAGES = ['日本語', 'English', '中文', '한국어', 'Español', 'Français', 'Deutsch'];

export default function TranslateScreen() {
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [fromLang, setFromLang] = useState('日本語');
  const [toLang, setToLang] = useState('English');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const POINT_COST = 15;

  const swapLanguages = () => {
    setFromLang(toLang);
    setToLang(fromLang);
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setResult('');
    await new Promise(r => setTimeout(r, 1800));
    setResult(mockTranslateResult);
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
            <Text style={styles.title}>翻訳</Text>
          </View>
          <View style={styles.costChip}>
            <Ionicons name="flash" size={12} color={Colors.active} />
            <Text style={[styles.costText, { color: Colors.active }]}>{POINT_COST}pt</Text>
          </View>
        </View>

        {/* Language selector */}
        <View style={styles.langSelector}>
          <TouchableOpacity style={styles.langBtn}>
            <Text style={styles.langLabel}>翻訳元</Text>
            <Text style={styles.langName}>{fromLang}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.swapBtn} onPress={swapLanguages}>
            <Ionicons name="swap-horizontal" size={22} color={Colors.cyan} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.langBtn}>
            <Text style={styles.langLabel}>翻訳先</Text>
            <Text style={[styles.langName, { color: Colors.active }]}>{toLang}</Text>
          </TouchableOpacity>
        </View>

        {/* Language chips */}
        <View style={styles.langChips}>
          <Text style={styles.langChipLabel}>翻訳先を選択：</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langChipScroll}>
            {LANGUAGES.filter(l => l !== fromLang).map(lang => (
              <TouchableOpacity
                key={lang}
                style={[styles.langChip, toLang === lang && styles.langChipActive]}
                onPress={() => setToLang(lang)}
              >
                <Text style={[styles.langChipText, toLang === lang && styles.langChipTextActive]}>
                  {lang}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Input
          label="翻訳するテキスト"
          value={inputText}
          onChangeText={setInputText}
          placeholder="ここにテキストを入力..."
          multiline
          numberOfLines={5}
        />

        <Button
          title={loading ? '翻訳中...' : '翻訳する'}
          onPress={handleTranslate}
          loading={loading}
          disabled={!inputText.trim()}
          variant="primary"
          size="lg"
          fullWidth
        />

        {loading && (
          <View style={styles.processingCard}>
            <ActivityIndicator color={Colors.active} />
            <Text style={styles.processingText}>翻訳処理中...</Text>
          </View>
        )}

        {result && !loading && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultLang}>{toLang}</Text>
              <Ionicons name="checkmark-circle" size={18} color={Colors.active} />
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
    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[2], paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
  },
  costText: { fontSize: 11, fontWeight: '700' },
  langSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg, padding: Spacing[4],
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing[3],
  },
  langBtn: { flex: 1, alignItems: 'center' },
  langLabel: { ...Typography.caption, color: Colors.textMuted, marginBottom: 4 },
  langName: { ...Typography.h4, color: Colors.textPrimary },
  swapBtn: { padding: Spacing[3] },
  langChips: { marginBottom: Spacing[4] },
  langChipLabel: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing[2] },
  langChipScroll: {},
  langChip: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderWidth: 1, borderColor: Colors.border, marginRight: Spacing[2],
  },
  langChipActive: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)' },
  langChipText: { ...Typography.bodySmall, color: Colors.textSecondary },
  langChipTextActive: { color: Colors.active, fontWeight: '600' },
  processingCard: {
    alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing[5], borderWidth: 1, borderColor: Colors.border, marginTop: Spacing[4], gap: Spacing[3],
  },
  processingText: { ...Typography.bodySmall, color: Colors.textSecondary },
  resultCard: {
    backgroundColor: 'rgba(34,197,94,0.05)', borderRadius: BorderRadius.lg,
    padding: Spacing[5], borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', marginTop: Spacing[4],
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing[3] },
  resultLang: { ...Typography.label, color: Colors.active },
  resultText: { ...Typography.body, color: Colors.textPrimary, lineHeight: 26 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginTop: Spacing[4], alignSelf: 'flex-end' },
  copyText: { ...Typography.bodySmall, color: Colors.textSecondary },
});
