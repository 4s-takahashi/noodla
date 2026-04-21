import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '../src/context/AppContext';
import { Colors } from '../src/theme';
// Phase 7-A: QueryClient singleton を使用（ws-store.ts と共有）
import { queryClient } from '../src/lib/queryClient';
// Phase 7-B: In-app トースト通知
import { useInAppNotification } from '../src/hooks/useInAppNotification';
import { ToastContainer } from '../src/components/ui/Toast';
// Phase 7-B: プッシュ通知パーミッション
import { requestPermissions } from '../src/services/notification-service';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { toasts, dismissToast } = useInAppNotification();

  useEffect(() => {
    // Hide splash after brief delay
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Phase 7-B: アプリ起動時にプッシュ通知パーミッションを要求
    requestPermissions().then((status) => {
      console.log('[Layout] Notification permission:', status);
    });
  }, []);

  return (
    <AppProvider>
      <StatusBar style="light" backgroundColor={Colors.bgPrimary} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bgPrimary },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="participation" />
        <Stack.Screen name="points" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="summarize" />
        <Stack.Screen name="translate" />
        <Stack.Screen name="draft" />
        <Stack.Screen name="supporter" />
        <Stack.Screen name="connection" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="error" />
      </Stack>
      {/* Phase 7-B: トースト通知オーバーレイ（全画面共通） */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
