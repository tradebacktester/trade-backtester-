import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { useAuth } from '@/context/auth-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), name.trim(), password);
      }
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={colors.foreground} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <View style={styles.logo}>
            <Ionicons name="trending-up" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.logoLabel}>Trade Lab</Text>
        </View>

        <Text style={styles.title}>{mode === 'signin' ? 'Welcome back' : 'Create account'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'signin'
            ? 'Sign in to access your strategies and backtests'
            : 'Start building and testing trading strategies'}
        </Text>

        <View style={styles.form}>
          {mode === 'signup' && (
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.field}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.foregroundSubtle}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.field}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.foregroundSubtle}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.field, { flex: 1, borderWidth: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.foregroundSubtle}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.foregroundSubtle} />
              </TouchableOpacity>
            </View>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={15} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.submitText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.switchMode}
          onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
        >
          <Text style={styles.switchModeText}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.switchModeLink}>
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  logoWrap: { alignItems: 'center', marginTop: 20, marginBottom: 36, gap: 12 },
  logo: {
    width: 72, height: 72,
    borderRadius: 20,
    backgroundColor: colors.brand,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: colors.foreground,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: colors.foregroundSubtle,
    lineHeight: 22,
    marginBottom: 36,
  },
  form: { gap: 16 },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: colors.foregroundMuted,
  },
  field: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.foreground,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: 12,
  },
  eyeBtn: { padding: 4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.errorDim,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.error,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: colors.brandForeground,
  },
  switchMode: { marginTop: 28, alignItems: 'center' },
  switchModeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.foregroundSubtle,
  },
  switchModeLink: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.foreground,
  },
});
