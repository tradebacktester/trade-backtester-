import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { apiRequest } from '@/lib/query-client';
import { useAuth } from '@/context/auth-context';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const STARTERS = [
  'Explain RSI and how to use it',
  'What is the Sharpe ratio?',
  'Best strategy for crypto markets?',
  'How does MACD crossover work?',
];

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  async function send(text: string) {
    if (!text.trim() || sending) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setSending(true);
    try {
      const res = await apiRequest<{ reply: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: res.reply },
      ]);
    } catch (e: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: e instanceof Error ? e.message : 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.heading}>Research</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={colors.foregroundSubtle} />
          <Text style={styles.emptyTitle}>Sign in to chat with AI</Text>
          <TouchableOpacity onPress={() => router.push('/login')} style={styles.signInBtn}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.heading}>Research</Text>
          <Text style={styles.subheading}>AI Trading Assistant · Powered by Groq</Text>
        </View>

        {messages.length === 0 ? (
          <View style={styles.starters}>
            <Text style={styles.starterLabel}>Try asking:</Text>
            {STARTERS.map((s) => (
              <TouchableOpacity key={s} style={styles.starterChip} onPress={() => send(s)}>
                <Text style={styles.starterText}>{s}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.foregroundSubtle} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                {item.role === 'assistant' && (
                  <View style={styles.aiIcon}>
                    <Ionicons name="sparkles" size={12} color={colors.brand} />
                  </View>
                )}
                <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.aiText]}>
                  {item.content}
                </Text>
              </View>
            )}
          />
        )}

        {sending && (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.typingText}>Thinking…</Text>
          </View>
        )}

        <View style={[styles.inputRow, { paddingBottom: bottomInset + 8 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything about trading…"
            placeholderTextColor={colors.foregroundSubtle}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: input.trim() && !sending ? 1 : 0.4 }]}
            onPress={() => send(input)}
            disabled={!input.trim() || sending}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  subheading: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.foregroundSubtle,
    marginTop: 2,
  },
  starters: { flex: 1, padding: 20, gap: 10 },
  starterLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.foregroundSubtle,
    marginBottom: 4,
  },
  starterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  starterText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.foreground,
    flex: 1,
  },
  messageList: { padding: 16, gap: 10, paddingBottom: 8 },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  aiIcon: {
    width: 22, height: 22,
    borderRadius: 11,
    backgroundColor: colors.brandDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bubbleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  userText: { color: '#FFFFFF' },
  aiText: { color: colors.foreground },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  typingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.foregroundSubtle,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.foreground,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: colors.foreground,
  },
  signInBtn: {
    marginTop: 8,
    backgroundColor: colors.brand,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  signInText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
