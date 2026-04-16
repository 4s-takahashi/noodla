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

export default function LoginScreen() {
  const router = useRouter();
  const { login: mockLogin } = useApp();
  const authStore = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (USE_REAL_API) {
        await authStore.login(email, password);
      } else {
        await new Promise(r => setTimeout(r, 1000));
        mockLogin(email, password);
      }
      router.replace('/(tabs)/home');
    } catch (err: any) {
      setError(err.message ?? 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoMini}>
              <Ionicons name="globe" size={32} color={Colors.cyan} />
            </View>
            <Text style={styles.title}>おかえりなさい</Text>
            <Text style={styles.subtitle}>アカウントにログインしてください</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="warning" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="メールアドレス"
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="パスワード"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>パスワードをお忘れですか？</Text>
            </TouchableOpacity>

            <Button
              title="ログイン"
              onPress={handleLogin}
              loading={loading}
              variant="primary"
              size="lg"
              fullWidth
              style={styles.submitBtn}
            />
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>または</Text>
            <View style={styles.divider} />
          </View>

          {/* Register */}
          <View style={styles.registerSection}>
            <Text style={styles.registerText}>アカウントをお持ちでない方は</Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}>新規登録</Text>
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
  forgotBtn: { alignSelf: 'flex-end', marginTop: -Spacing[2], marginBottom: Spacing[5] },
  forgotText: { ...Typography.bodySmall, color: Colors.cyan },
  submitBtn: { marginTop: Spacing[2] },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginBottom: Spacing[6] },
  divider: { flex: 1, height: 1, backgroundColor: Colors.borderLight },
  dividerText: { ...Typography.bodySmall, color: Colors.textMuted },
  registerSection: { flexDirection: 'row', justifyContent: 'center', gap: Spacing[2] },
  registerText: { ...Typography.body, color: Colors.textSecondary },
  registerLink: { ...Typography.body, color: Colors.cyan, fontWeight: '600' },
});
