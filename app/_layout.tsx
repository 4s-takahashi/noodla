import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../src/context/AppContext';
import { Colors } from '../src/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash after brief delay
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
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
      </AppProvider>
    </SafeAreaProvider>
  );
}
