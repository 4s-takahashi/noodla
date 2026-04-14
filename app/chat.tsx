import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { useApp } from '../src/context/AppContext';
import { ChatMessage } from '../src/types/ai';
import { formatTime } from '../src/utils/format';

export default function ChatScreen() {
  const router = useRouter();
  const { chatHistory, addChatMessage, user } = useApp();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const POINT_COST = 30;
  const canSend = input.trim().length > 0 && !isProcessing && user.points >= POINT_COST;

  const mockResponses = [
    'Noodlaネットワークが分析しています。分散AIの力で、あなたの質問に答えます。',
    'それは興味深い質問です。世界中のノードが協力して処理しています。現在12,847台のデバイスがあなたをサポートしています。',
    'ご質問ありがとうございます。Noodlaの分散処理により、高品質な回答をお届けします。',
    '分散AIネットワークによる処理が完了しました。複数のノードが協調して最適な回答を生成しました。',
  ];

  const handleSend = async () => {
    if (!canSend) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMsg);
    setInput('');
    setIsProcessing(true);

    // Simulate network processing delay
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

    const aiMsg: ChatMessage = {
      id: `msg-${Date.now()}-ai`,
      role: 'assistant',
      content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
      timestamp: new Date().toISOString(),
    };
    addChatMessage(aiMsg);
    setIsProcessing(false);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>AIチャット</Text>
          <View style={styles.processingIndicator}>
            <View style={styles.processingDot} />
            <Text style={styles.processingText}>Noodlaネットワーク接続中</Text>
          </View>
        </View>
        <View style={styles.costChip}>
          <Ionicons name="flash" size={12} color={Colors.cyan} />
          <Text style={styles.costText}>{POINT_COST}pt/回</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {chatHistory.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.role === 'user' ? styles.userBubble : styles.aiBubble,
              ]}
            >
              {msg.role === 'assistant' && (
                <View style={styles.aiAvatar}>
                  <Ionicons name="globe" size={16} color={Colors.cyan} />
                </View>
              )}
              <View style={[
                styles.bubbleContent,
                msg.role === 'user' ? styles.userBubbleContent : styles.aiBubbleContent,
              ]}>
                <Text style={[
                  styles.messageText,
                  msg.role === 'user' ? styles.userMessageText : styles.aiMessageText,
                ]}>
                  {msg.content}
                </Text>
                <Text style={[
                  styles.messageTime,
                  msg.role === 'user' && styles.userMessageTime,
                ]}>
                  {formatTime(msg.timestamp)}
                </Text>
              </View>
            </View>
          ))}

          {isProcessing && (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <View style={styles.aiAvatar}>
                <Ionicons name="globe" size={16} color={Colors.cyan} />
              </View>
              <View style={styles.aiBubbleContent}>
                <View style={styles.processingBubble}>
                  <ActivityIndicator size="small" color={Colors.cyan} />
                  <Text style={styles.processingBubbleText}>ネットワーク処理中...</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Balance warning */}
        {user.points < POINT_COST && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={16} color={Colors.standby} />
            <Text style={styles.warningText}>
              ポイントが不足しています（{POINT_COST}pt必要）
            </Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputArea}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="メッセージを入力..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, canSend && styles.sendBtnActive]}
              onPress={handleSend}
              disabled={!canSend}
            >
              <Ionicons
                name="send"
                size={18}
                color={canSend ? Colors.bgPrimary : Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing[3],
  },
  backBtn: { padding: Spacing[1] },
  headerCenter: { flex: 1 },
  title: { ...Typography.h4, color: Colors.textPrimary },
  processingIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1], marginTop: 2 },
  processingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.active },
  processingText: { ...Typography.caption, color: Colors.active },
  costChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,210,255,0.1)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[2],
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.2)',
  },
  costText: { fontSize: 11, fontWeight: '700', color: Colors.cyan },
  kav: { flex: 1 },
  messages: { flex: 1 },
  messagesContent: { padding: Spacing[4], gap: Spacing[3] },
  messageBubble: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[2], maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  aiBubble: { alignSelf: 'flex-start' },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,210,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubbleContent: { borderRadius: BorderRadius.lg, padding: Spacing[3], maxWidth: '100%' },
  userBubbleContent: {
    backgroundColor: Colors.cyan,
    borderBottomRightRadius: 4,
  },
  aiBubbleContent: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: { ...Typography.body, lineHeight: 22 },
  userMessageText: { color: Colors.bgPrimary },
  aiMessageText: { color: Colors.textPrimary },
  messageTime: { ...Typography.caption, color: Colors.textMuted, marginTop: 4, textAlign: 'right' },
  userMessageTime: { color: 'rgba(26,26,46,0.6)' },
  processingBubble: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], padding: Spacing[1] },
  processingBubbleText: { ...Typography.bodySmall, color: Colors.textSecondary },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,158,11,0.2)',
  },
  warningText: { ...Typography.bodySmall, color: Colors.standby },
  inputArea: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingLeft: Spacing[4],
    paddingRight: Spacing[2],
    paddingVertical: Spacing[2],
    gap: Spacing[2],
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    maxHeight: 100,
    paddingVertical: Spacing[1],
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgCardDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: Colors.cyan },
});
