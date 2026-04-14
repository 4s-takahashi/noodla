import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Button } from '../src/components/ui';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    icon: 'globe',
    iconColor: Colors.cyan,
    title: 'Noodlaとは？',
    description:
      'スマートフォンのアイドル時間を活用して、世界中の分散AIネットワークに参加しましょう。あなたのデバイスが世界とつながります。',
    bg: 'rgba(0,210,255,0.06)',
  },
  {
    id: '2',
    icon: 'hardware-chip',
    iconColor: Colors.purpleLight,
    title: '参加してポイントを獲得',
    description:
      'デバイスがネットワークに参加するたびにポイントが貯まります。タスク処理量に応じて、毎日ポイントを受け取れます。',
    bg: 'rgba(124,58,237,0.06)',
  },
  {
    id: '3',
    icon: 'sparkles',
    iconColor: Colors.gold,
    title: 'ポイントでAIを使おう',
    description:
      '貯めたポイントでチャット・要約・翻訳・文章生成などのAI機能を使えます。ポイントを消費して、賢くAIを活用しましょう。',
    bg: 'rgba(255,215,0,0.05)',
  },
  {
    id: '4',
    icon: 'trophy',
    iconColor: Colors.active,
    title: 'ランクを上げて特典をゲット',
    description:
      'Bronze → Silver → Gold → Platinum とランクアップするごとに特典が増えます。継続参加でどんどん成長しましょう！',
    bg: 'rgba(34,197,94,0.06)',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goToNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      router.replace('/login');
    }
  };

  const skip = () => {
    router.replace('/login');
  };

  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(idx);
  };

  const isLast = currentIndex === slides.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity onPress={skip} style={styles.skipBtn}>
          <Text style={styles.skipText}>スキップ</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
      >
        {slides.map((slide) => (
          <View key={slide.id} style={styles.slide}>
            <View style={[styles.iconWrapper, { backgroundColor: slide.bg }]}>
              <Ionicons name={slide.icon as any} size={80} color={slide.iconColor} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Action */}
      <View style={styles.actions}>
        <Button
          title={isLast ? 'はじめる' : '次へ'}
          onPress={goToNext}
          variant="primary"
          size="lg"
          fullWidth
        />
        {isLast && (
          <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              すでにアカウントをお持ちの方はこちら
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
  },
  skipBtn: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
  },
  skipText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[8],
  },
  iconWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[8],
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing[4],
  },
  description: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[6],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.bgCard,
  },
  dotActive: {
    backgroundColor: Colors.cyan,
    width: 24,
  },
  actions: {
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[8],
  },
  loginLink: {
    marginTop: Spacing[4],
    alignItems: 'center',
  },
  loginLinkText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
