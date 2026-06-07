import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { useAuth } from '@/context/auth-context';

function Row({ icon, label, value, onPress, danger }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? colors.error : colors.foregroundMuted} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.error }]}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.foregroundSubtle} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  function handleSignOut() {
    if (Platform.OS === 'web') {
      signOut();
      return;
    }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.heading}>Profile</Text>
        </View>
        <View style={styles.center}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={40} color={colors.foregroundSubtle} />
          </View>
          <Text style={styles.emptyTitle}>Not signed in</Text>
          <Text style={styles.emptySubtitle}>Sign in to access your account, strategies, and backtests</Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/login')}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Profile</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <Row icon="mail-outline" label="Email" value={user.email} />
            <View style={styles.divider} />
            <Row icon="person-outline" label="Name" value={user.name} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>App</Text>
          <View style={styles.card}>
            <Row icon="bar-chart-outline" label="My Backtests" onPress={() => router.push('/(tabs)/backtests')} />
            <View style={styles.divider} />
            <Row icon="sparkles-outline" label="AI Assistant" onPress={() => router.push('/(tabs)/ai')} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <Row icon="log-out-outline" label="Sign Out" onPress={handleSignOut} danger />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
    borderRadius: colors.radius,
    padding: 20,
  },
  avatar: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: colors.brandForeground,
  },
  avatarLarge: {
    width: 90, height: 90,
    borderRadius: 45,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: colors.foreground,
  },
  email: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.foregroundSubtle,
    marginTop: 2,
  },
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: colors.foregroundSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: colors.radius,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  rowIcon: {
    width: 34, height: 34,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: colors.errorDim },
  rowLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: colors.foreground,
    flex: 1,
  },
  rowValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.foregroundSubtle,
    maxWidth: 160,
  },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 62 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: colors.foreground,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.foregroundSubtle,
    textAlign: 'center',
    lineHeight: 20,
  },
  signInBtn: {
    marginTop: 12,
    backgroundColor: colors.brand,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 14,
  },
  signInText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
