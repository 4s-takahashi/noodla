import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Button } from '../src/components/ui/Button';

export default function ErrorScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Illustration */}
        <View style={styles.illustration}>
          <View style={styles.iconWrapper}>
            <Ionicons name="cloud-offline" size={64} color={Colors.textMuted} />
          </View>
          <View style={styles.waveRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <View key={i} style={[styles.wave, { opacity: i * 0.15, height: i * 6 }]} />
            ))}
          </View>
        </View>

        <Text style={styles.title}>接続できません</Text>
        <Text style={styles.subtitle}>
          Noodlaネットワークへの接続に問題が発生しました。
          {'\n'}Wi-Fi環境を確認してもう一度お試しください。
        </Text>

        {/* Tips */}
        <View style={styles.tips}>
          {[
            'Wi-Fi接続を確認してください',
            '機内モードがオフになっているか確認してください',
            'アプリを再起動してみてください',
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="再試行"
            onPress={() => {}}
            variant="primary"
            size="lg"
            fullWidth
            style={styles.retryBtn}
          />
          <Button
            title="ホームに戻る"
            onPress={() => router.replace('/(tabs)/home')}
            variant="outline"
            size="lg"
            fullWidth
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing[8],
  },
  illustration: { alignItems: 'center', marginBottom: Spacing[8] },
  iconWrapper: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing[4],
  },
  waveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[2] },
  wave: { width: 4, backgroundColor: Colors.textMuted, borderRadius: 2 },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing[3] },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 26, marginBottom: Spacing[6] },
  tips: { alignSelf: 'stretch', gap: Spacing[3], marginBottom: Spacing[8] },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  tipText: { ...Typography.bodySmall, color: Colors.textMuted },
  actions: { alignSelf: 'stretch', gap: Spacing[3] },
  retryBtn: {},
});
