/**
 * Toast.tsx — In-app トースト通知コンポーネント (Phase 7-B)
 *
 * WebSocket 経由で受信した notification_push メッセージをアプリ内で表示する。
 * - 画面上部に 3 秒間表示してから自動消去
 * - タップで通知画面へ遷移
 * - 既存デザインシステムに合わせた外観
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

// ── Toast Item ────────────────────────────────────────────────────────────────

export interface ToastItem {
  id: string;
  notifType: string;
  title: string;
  body: string;
}

// ── Type → Color/Icon マッピング ──────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  rank_up: Colors.gold,
  points: Colors.active,
  milestone: Colors.purpleLight,
  maintenance: Colors.standby,
  admin: Colors.cyan,
  system: Colors.cyan,
};

const TYPE_ICON: Record<string, string> = {
  rank_up: 'trophy',
  points: 'star',
  milestone: 'flame',
  maintenance: 'construct',
  admin: 'information-circle',
  system: 'notifications',
};

// ── Toast Component ───────────────────────────────────────────────────────────

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const DISPLAY_DURATION_MS = 3_000;

export function Toast({ toast, onDismiss }: ToastProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  const color = TYPE_COLOR[toast.notifType] ?? Colors.cyan;
  const icon = TYPE_ICON[toast.notifType] ?? 'notifications';

  useEffect(() => {
    // フェードイン + スライドイン
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // 3秒後にフェードアウト
    const timer = setTimeout(() => {
      dismiss();
    }, DISPLAY_DURATION_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const handlePress = () => {
    dismiss();
    router.push('/notifications');
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + Spacing[2],
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.inner}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{toast.body}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── ToastContainer ────────────────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

/**
 * 複数のトーストを縦に積み上げて表示するコンテナ。
 * app/_layout.tsx の最上位に配置する。
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing[4],
    right: Spacing[4],
    zIndex: 9999,
    // シャドウ
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing[3],
    gap: Spacing[3],
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  body: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  closeBtn: {
    flexShrink: 0,
  },
});
