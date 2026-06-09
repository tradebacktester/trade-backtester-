import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { apiRequest } from '@/lib/query-client';
import { useAuth } from '@/context/auth-context';

const PURPLE = '#7C3AED';
const PURPLE_DIM = 'rgba(124,58,237,0.12)';
const PURPLE_BORDER = 'rgba(124,58,237,0.25)';

interface BucketEntry {
  label: string;
  winRate: number;
  avgPnlPct: number;
  trades: number;
}

interface SessionData {
  byDay: BucketEntry[];
  bySession: BucketEntry[];
  byMarket: BucketEntry[];
  hasData: boolean;
}

interface CoachingData {
  traderScore: number;
  traderStyle: string;
  traderStyleColor: string;
  avgHoldingDays: number;
  avgWinRate: number;
  avgSharpe: number;
  avgDrawdown: number;
  avgProfitFactor: number;
  backtestCount: number;
  hasData: boolean;
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function winRateColor(wr: number): string {
  if (wr >= 65) return colors.success;
  if (wr >= 50) return '#A78BFA';
  if (wr >= 35) return colors.warning;
  return colors.error;
}

function DayBar({ entry, maxTrades }: { entry: BucketEntry; maxTrades: number }) {
  const barPct = maxTrades > 0 ? entry.trades / maxTrades : 0;
  const c = winRateColor(entry.winRate);
  const up = entry.avgPnlPct >= 0;

  return (
    <View style={bar.row}>
      <Text style={bar.day}>{entry.label}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { flex: barPct, backgroundColor: c }]} />
        <View style={{ flex: 1 - barPct }} />
      </View>
      <Text style={[bar.wr, { color: c }]}>{entry.winRate.toFixed(0)}%</Text>
      <Text style={[bar.pnl, { color: up ? colors.success : colors.error }]}>
        {up ? '+' : ''}{entry.avgPnlPct.toFixed(1)}%
      </Text>
    </View>
  );
}

const bar = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  day: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.foregroundMuted, width: 30 },
  track: { flex: 1, height: 8, borderRadius: 4, flexDirection: 'row', backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { borderRadius: 4 },
  wr: { fontFamily: 'Inter_600SemiBold', fontSize: 12, width: 36, textAlign: 'right' },
  pnl: { fontFamily: 'Inter_500Medium', fontSize: 12, width: 46, textAlign: 'right' },
});

function SessionRow({ entry, isBest, isWeak }: { entry: BucketEntry; isBest: boolean; isWeak: boolean }) {
  const up = entry.avgPnlPct >= 0;
  return (
    <View style={ses.row}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={ses.label}>{entry.label}</Text>
          {isBest && (
            <View style={ses.bestTag}>
              <Text style={ses.bestText}>BEST</Text>
            </View>
          )}
          {isWeak && (
            <View style={ses.weakTag}>
              <Text style={ses.weakText}>WEAK</Text>
            </View>
          )}
        </View>
        <Text style={ses.trades}>{entry.trades} trades</Text>
      </View>
      <Text style={[ses.wr, { color: winRateColor(entry.winRate) }]}>
        {entry.winRate.toFixed(0)}% WR
      </Text>
      <Text style={[ses.pnl, { color: up ? colors.success : colors.error }]}>
        {up ? '+' : ''}{entry.avgPnlPct.toFixed(2)}%
      </Text>
    </View>
  );
}

const ses = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.foreground },
  trades: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.foregroundSubtle, marginTop: 2 },
  bestTag: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bestText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: colors.success },
  weakTag: {
    backgroundColor: colors.errorDim,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  weakText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: colors.error },
  wr: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pnl: { fontFamily: 'Inter_500Medium', fontSize: 13, width: 54, textAlign: 'right' },
});

export default function TraderDnaScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const { data: coaching, isLoading: cLoading } = useQuery<CoachingData>({
    queryKey: ['/api/ai/coaching-insights'],
    queryFn: () => apiRequest('/api/ai/coaching-insights'),
    enabled: !!user,
  });

  const { data: session, isLoading: sLoading } = useQuery<SessionData>({
    queryKey: ['/api/ai/session-analysis'],
    queryFn: () => apiRequest('/api/ai/session-analysis'),
    enabled: !!user,
  });

  const isLoading = cLoading || sLoading;

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.heading}>Trader DNA</Text>
          <Text style={styles.subheading}>Your performance profile</Text>
        </View>
        <View style={styles.center}>
          <View style={styles.guestIcon}>
            <Ionicons name="analytics-outline" size={36} color={colors.foregroundSubtle} />
          </View>
          <Text style={styles.guestTitle}>Sign in to view your Trader DNA</Text>
          <Text style={styles.guestSub}>
            Day-of-week patterns, session win rates, and trader type analysis — all from your backtest history.
          </Text>
          <TouchableOpacity onPress={() => router.push('/login')} style={styles.signInBtn}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasCoaching = coaching?.hasData;
  const hasSession = session?.hasData;

  // Sort days in calendar order
  const sortedDays = (session?.byDay ?? [])
    .slice()
    .sort((a, b) => DAY_ORDER.indexOf(a.label) - DAY_ORDER.indexOf(b.label));

  const maxTrades = sortedDays.reduce((m, d) => Math.max(m, d.trades), 0);

  // Best / worst sessions
  const sessionRows = session?.bySession ?? [];
  const bestSession = sessionRows.length
    ? sessionRows.reduce((best, s) => (s.winRate > best.winRate ? s : best), sessionRows[0])
    : null;
  const weakSession = sessionRows.length
    ? sessionRows.reduce((weak, s) => (s.winRate < weak.winRate ? s : weak), sessionRows[0])
    : null;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Trader DNA</Text>
          <Text style={styles.subheading}>Performance profile</Text>
        </View>
        <View style={styles.aiTag}>
          <Ionicons name="analytics" size={12} color="#A78BFA" />
          <Text style={styles.aiTagText}>AI</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PURPLE} size="large" />
          <Text style={styles.loadingText}>Building your profile…</Text>
        </View>
      ) : !hasCoaching && !hasSession ? (
        <View style={styles.center}>
          <Ionicons name="analytics-outline" size={48} color={colors.foregroundSubtle} />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySub}>
            Run a backtest or place paper trades to generate your Trader DNA profile.
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/backtests')} style={styles.ctaBtn}>
            <Text style={styles.ctaBtnText}>Go to Strategy Lab</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Trader Type Badge */}
          {hasCoaching && coaching && (
            <View style={styles.typeCard}>
              <View style={styles.typeLeft}>
                <View style={styles.scorePill}>
                  <Text style={styles.scoreNum}>{coaching.traderScore}</Text>
                  <Text style={styles.scoreOf}>/100</Text>
                </View>
              </View>
              <View style={styles.typeRight}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{coaching.traderStyle}</Text>
                </View>
                <Text style={styles.typeDetail}>
                  Avg hold · {coaching.avgHoldingDays.toFixed(1)} days
                </Text>
                <View style={styles.typeStats}>
                  <Text style={styles.typeStat}>WR {coaching.avgWinRate.toFixed(0)}%</Text>
                  <Text style={styles.typeStatSep}>·</Text>
                  <Text style={styles.typeStat}>PF {coaching.avgProfitFactor?.toFixed(2) ?? '—'}</Text>
                  <Text style={styles.typeStatSep}>·</Text>
                  <Text style={[styles.typeStat, { color: colors.error }]}>DD -{coaching.avgDrawdown.toFixed(0)}%</Text>
                </View>
              </View>
            </View>
          )}

          {/* Day-of-Week Performance */}
          {sortedDays.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Day-of-Week Performance</Text>
              <Text style={styles.cardSubtitle}>Bar width = trade count · Color = win rate</Text>
              <View style={{ marginTop: 12 }}>
                {sortedDays.map((d) => (
                  <DayBar key={d.label} entry={d} maxTrades={maxTrades} />
                ))}
              </View>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.legendText}>≥65%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#A78BFA' }]} />
                  <Text style={styles.legendText}>50–64%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                  <Text style={styles.legendText}>35–49%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
                  <Text style={styles.legendText}>{'<35%'}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Session Win Rate */}
          {sessionRows.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Session Win Rate</Text>
              <Text style={styles.cardSubtitle}>
                Backtest sessions estimated from market type
              </Text>
              {sessionRows.map((s, i) => (
                <View key={s.label}>
                  {i > 0 && <View style={styles.rowDivider} />}
                  <SessionRow
                    entry={s}
                    isBest={s.label === bestSession?.label}
                    isWeak={s.label === weakSession?.label && sessionRows.length > 1}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Market Breakdown */}
          {(session?.byMarket ?? []).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Market Breakdown</Text>
              {(session?.byMarket ?? []).map((m, i) => (
                <View key={m.label}>
                  {i > 0 && <View style={styles.rowDivider} />}
                  <View style={ses.row}>
                    <Text style={{ ...ses.label, flex: 1 }}>{m.label}</Text>
                    <Text style={[ses.wr, { color: winRateColor(m.winRate) }]}>
                      {m.winRate.toFixed(0)}% WR
                    </Text>
                    <Text style={[ses.pnl, {
                      color: m.avgPnlPct >= 0 ? colors.success : colors.error,
                    }]}>
                      {m.avgPnlPct >= 0 ? '+' : ''}{m.avgPnlPct.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
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
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PURPLE_DIM,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
  },
  aiTagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#A78BFA',
  },
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  typeCard: {
    backgroundColor: colors.surface,
    borderRadius: colors.radius,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
  },
  typeLeft: { alignItems: 'center' },
  scorePill: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: PURPLE_DIM,
    borderWidth: 2,
    borderColor: PURPLE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#A78BFA' },
  scoreOf: { fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.foregroundSubtle },
  typeRight: { flex: 1, gap: 6 },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: PURPLE_DIM,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
  },
  typeBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#A78BFA' },
  typeDetail: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.foregroundSubtle },
  typeStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeStat: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.foregroundMuted },
  typeStatSep: { color: colors.border, fontSize: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: colors.radius,
    padding: 16,
  },
  cardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: colors.foreground,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.foregroundSubtle,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.foregroundSubtle },
  rowDivider: { height: 1, backgroundColor: colors.border },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  guestIcon: {
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: PURPLE_DIM,
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  guestTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: colors.foreground,
    textAlign: 'center',
    lineHeight: 25,
  },
  guestSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.foregroundSubtle,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: colors.foreground,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.foregroundSubtle,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.foregroundSubtle,
  },
  signInBtn: {
    marginTop: 8,
    backgroundColor: PURPLE,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  signInText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  ctaBtn: {
    marginTop: 8,
    backgroundColor: PURPLE,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  bottomSpacer: { height: 12 },
});
