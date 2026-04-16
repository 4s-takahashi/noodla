import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Button, Input } from '../src/components/ui';
import { useApp } from '../src/context/AppContext';
import { useAuthStore } from '../src/stores/auth-store';
import { USE_REAL_API } from '../src/api/config';

export default function RegisterScreen() {
  const router = useRouter();
  const { login: mockLogin } = useApp();
  const authStore = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('すべての項目を入力してください');
      return;
    }
    if (!agreed) {
      setError('利用規約への同意が必要です');
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (USE_REAL_API) {
        await authStore.register(email, password, name);
      } else {
        await new Promise(r => setTimeout(r, 1200));
        mockLogin(email, password);
      }
      router.replace('/(tabs)/home');
    } catch (err: any) {
      setError(err.message ?? '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoMini}>
              <Ionicons name="person-add" size={32} color={Colors.cyan} />
            </View>
            <Text style={styles.title}>新規登録</Text>
            <Text style={styles.subtitle}>Noodlaコミュニティに参加しよう</Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="warning" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="お名前"
              value={name}
              onChangeText={setName}
              placeholder="田中太郎"
              autoCapitalize="words"
            />
            <Input
              label="メールアドレス"
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              keyboardType="email-address"
            />
            <Input
              label="パスワード"
              value={password}
              onChangeText={setPassword}
              placeholder="8文字以上"
              secureTextEntry
              hint="英数字を組み合わせた8文字以上のパスワード"
            />

            {/* Terms agreement */}
            <TouchableOpacity
              style={styles.agreeRow}
              onPress={() => setAgreed(!agreed)}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Ionicons name="checkmark" size={14} color={Colors.bgPrimary} />}
              </View>
              <Text style={styles.agreeText}>
                <Text style={styles.agreeLink}>利用規約</Text>
                {'  '}および{'  '}
                <Text style={styles.agreeLink}>プライバシーポリシー</Text>
                に同意します
              </Text>
            </TouchableOpacity>

            <Button
              title="アカウントを作成"
              onPress={handleRegister}
              loading={loading}
              variant="primary"
              size="lg"
              fullWidth
              style={styles.submitBtn}
            />
          </View>

          <View style={styles.loginSection}>
            <Text style={styles.loginText}>すでにアカウントをお持ちの方は</Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.loginLink}>ログイン</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing[6], paddingBottom: Spacing[8] },
  backBtn: { marginTop: Spacing[3], marginBottom: Spacing[6], alignSelf: 'flex-start' },
  header: { alignItems: 'center', marginBottom: Spacing[8] },
  logoMini: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,210,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.25)',
  },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing[2] },
  subtitle: { ...Typography.body, color: Colors.textSecondary },
  form: { marginBottom: Spacing[6] },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing[3],
    marginBottom: Spacing[4],
    gap: Spacing[2],
  },
  errorText: { ...Typography.bodySmall, color: Colors.error, flex: 1 },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], marginBottom: Spacing[5] },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  agreeText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  agreeLink: { color: Colors.cyan },
  submitBtn: {},
  loginSection: { flexDirection: 'row', justifyContent: 'center', gap: Spacing[2] },
  loginText: { ...Typography.body, color: Colors.textSecondary },
  loginLink: { ...Typography.body, color: Colors.cyan, fontWeight: '600' },
});
