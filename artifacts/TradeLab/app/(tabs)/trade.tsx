import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { apiRequest } from '@/lib/query-client';

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SymbolData {
  symbol: string;
  price: number;
  change24h: number;
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
];

function computeMarketData(symbol: string, bars: Bar[]): SymbolData {
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const price = last?.close ?? 0;
  const change24h = prev?.close
    ? ((last.close - prev.close) / prev.close) * 100
    : 0;
  return { symbol, price, change24h };
}

function PriceRow({ item }: { item: SymbolData }) {
  const up = item.change24h >= 0;
  const changeColor = up ? colors.success : colors.error;
  const base = item.symbol.replace('USDT', '');

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={[styles.symbolBadge, { backgroundColor: BADGE_COLORS[base] ?? '#7C3AED' }]}>
          <Text style={styles.symbolBadgeText}>{base[0]}</Text>
        </View>
        <View>
          <Text style={styles.symbol}>{base}</Text>
          <Text style={styles.pair}>/ USDT</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.price}>
          {item.price < 1
            ? `$${item.price.toFixed(4)}`
            : `$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </Text>
        <View style={[styles.changeBadge, { backgroundColor: up ? colors.successDim : colors.errorDim }]}>
          <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={10} color={changeColor} />
          <Text style={[styles.change, { color: changeColor }]}>
            {Math.abs(item.change24h).toFixed(2)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const BADGE_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', BNB: '#F3BA2F',
  XRP: '#00AAE4', ADA: '#0033AD', DOGE: '#C2A633', AVAX: '#E84142',
  DOT: '#E6007A', LINK: '#2A5ADA',
};

export default function TradeScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const results = useQueries({
    queries: SYMBOLS.map((symbol) => ({
      queryKey: ['/api/klines', symbol],
      queryFn: () =>
        apiRequest<Bar[]>(`/api/klines?symbol=${symbol}&interval=1d&limit=2`),
      refetchInterval: 30_000,
      staleTime: 20_000,
    })),
  });

  const isLoading = results.every((r) => r.isLoading);
  const data: SymbolData[] = results
    .map((r, i) => {
      if (!r.data?.length) return null;
      return computeMarketData(SYMBOLS[i], r.data);
    })
    .filter((d): d is SymbolData => d !== null);

  function refetchAll() {
    results.forEach((r) => r.refetch());
  }

  const isRefetching = results.some((r) => r.isFetching);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Trade</Text>
          <Text style={styles.subheading}>
            {data.length} symbols · live prices
          </Text>
        </View>
        <TouchableOpacity onPress={refetchAll} style={styles.refreshBtn}>
          <Ionicons
            name={isRefetching ? 'sync' : 'refresh'}
            size={20}
            color={colors.foregroundMuted}
          />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#7C3AED" size="large" />
          <Text style={styles.loadingText}>Loading markets…</Text>
        </View>
      ) : !data.length ? (
        <View style={styles.center}>
          <Ionicons name="trending-up-outline" size={48} color={colors.foregroundSubtle} />
          <Text style={styles.emptyText}>Market data unavailable</Text>
          <TouchableOpacity onPress={refetchAll} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item }) => <PriceRow item={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
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
  refreshBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: colors.radius,
    padding: 16,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  symbolBadge: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  symbol: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: colors.foreground,
  },
  pair: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.foregroundSubtle,
    marginTop: 2,
  },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  price: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: colors.foreground,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  change: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  separator: { height: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.foregroundSubtle,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: colors.foregroundSubtle,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 10,
    marginTop: 4,
  },
  retryText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: colors.foreground,
  },
});
