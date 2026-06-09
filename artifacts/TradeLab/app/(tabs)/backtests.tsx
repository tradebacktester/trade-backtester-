import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { apiRequest } from '@/lib/query-client';
import { useAuth } from '@/context/auth-context';

interface Backtest {
  id: number;
  symbol: string;
  strategyType: string;
  totalReturn: number;
  winRate: number;
  sharpeRatio: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

function BacktestCard({ item }: { item: Backtest }) {
  const up = item.totalReturn >= 0;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={styles.symbol}>{item.symbol.replace('USDT', '/USDT')}</Text>
          <Text style={styles.strategy}>{item.strategyType.replace(/_/g, ' ')}</Text>
        </View>
        <View style={[styles.returnBadge, { backgroundColor: up ? colors.successDim : colors.errorDim }]}>
          <Text style={[styles.returnText, { color: up ? colors.success : colors.error }]}>
            {up ? '+' : ''}{Number(item.totalReturn).toFixed(2)}%
          </Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Win Rate</Text>
          <Text style={styles.metricValue}>{Number(item.winRate).toFixed(1)}%</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Sharpe</Text>
          <Text style={styles.metricValue}>{Number(item.sharpeRatio).toFixed(2)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Period</Text>
          <Text style={styles.metricValue}>
            {new Date(item.startDate).getFullYear()}–{new Date(item.endDate).getFullYear()}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function BacktestsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const { data, isLoading, refetch } = useQuery<Backtest[]>({
    queryKey: ['/api/backtests'],
    queryFn: () => apiRequest('/api/backtests'),
    enabled: !!user,
  });

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Strategy Lab</Text>
          <Text style={styles.subheading}>
            {data?.length ?? 0} results
          </Text>
        </View>
      </View>

      {!user ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.foregroundSubtle} />
          <Text style={styles.emptyTitle}>Sign in to view backtests</Text>
          <TouchableOpacity onPress={() => router.push('/login')} style={styles.signInBtn}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : !data?.length ? (
        <View style={styles.center}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.foregroundSubtle} />
          <Text style={styles.emptyTitle}>No backtests yet</Text>
          <Text style={styles.emptySubtitle}>Run a backtest on the web app to see results here</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <BacktestCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={false}
          scrollEnabled={!!data?.length}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  subheading: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.foregroundSubtle,
    marginTop: 2,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: colors.radius,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardLeft: { gap: 4 },
  symbol: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: colors.foreground,
  },
  strategy: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.foregroundSubtle,
    textTransform: 'capitalize',
  },
  returnBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  returnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    padding: 12,
  },
  metric: { flex: 1, alignItems: 'center', gap: 4 },
  metricLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.foregroundSubtle,
  },
  metricValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.foreground,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: colors.foreground,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.foregroundSubtle,
    textAlign: 'center',
    lineHeight: 20,
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
