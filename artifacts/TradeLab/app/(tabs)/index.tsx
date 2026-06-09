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

interface CoachingInsight {
  text: string;
  improvementPct: number;
  category: string;
}

interface Mistake {
  label: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
}

interface CoachingData {
  traderScore: number;
  traderStyle: string;
  traderStyleColor: string;
  avgWinRate: number;
  avgSharpe: number;
  avgDrawdown: number;
  backtestCount: number;
  insights: CoachingInsight[];
  mistakes: Mistake[];
  hasData: boolean;
}

function ScoreRing({ score }: { score: number }) {
  const label =
    score >= 80 ? 'Elite' :
    score >= 60 ? 'Advanced' :
    score >= 40 ? 'Developing' : 'Beginner';
  const labelColor =
    score >= 80 ? colors.success :
    score >= 60 ? '#A78BFA' :
    score >= 40 ? colors.warning : colors.foregroundSubtle;

  return (
    <View style={ring.wrap}>
      <View style={ring.outer}>
        <View style={ring.inner}>
          <Text style={ring.score}>{score}</Text>
          <Text style={ring.label}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const ring = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 4 },
  outer: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: PURPLE_DIM,
    borderWidth: 3, borderColor: PURPLE_BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  inner: { alignItems: 'center' },
  score: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: '#A78BFA',
    letterSpacing: -1,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: colors.foregroundSubtle,
    marginTop: 1,
  },
});

function MistakeSeverityDot({ severity }: { severity: string }) {
  const c = severity === 'high' ? colors.error : severity === 'medium' ? colors.warning : colors.foregroundSubtle;
  return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c, marginTop: 3 }} />;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const { data, isLoading } = useQuery<CoachingData>({
    queryKey: ['/api/ai/coaching-insights'],
    queryFn: () => apiRequest('/api/ai/coaching-insights'),
    enabled: !!user,
  });

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <Text style={styles.heading}>Home</Text>
          <Text style={styles.subheading}>Your trading command center</Text>
        </View>
        <View style={styles.center}>
          <View style={styles.guestIcon}>
            <Ionicons name="home-outline" size={36} color={colors.foregroundSubtle} />
          </View>
          <Text style={styles.guestTitle}>Sign in to unlock your AI dashboard</Text>
          <Text style={styles.guestSub}>
            Trader score, AI coaching insights, and pattern alerts — all personalized to your trading history.
          </Text>
          <TouchableOpacity onPress={() => router.push('/login')} style={styles.signInBtn}>
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Home</Text>
          <Text style={styles.subheading}>
            {user.name.split(' ')[0]}'s trading dashboard
          </Text>
        </View>
        <View style={styles.aiTag}>
          <Ionicons name="sparkles" size={12} color="#A78BFA" />
          <Text style={styles.aiTagText}>AI</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PURPLE} size="large" />
          <Text style={styles.loadingText}>Analysing your trades…</Text>
        </View>
      ) : !data?.hasData ? (
        <View style={styles.center}>
          <Ionicons name="analytics-outline" size={48} color={colors.foregroundSubtle} />
          <Text style={styles.emptyTitle}>No trading data yet</Text>
          <Text style={styles.emptySub}>
            Run a backtest or place a paper trade to unlock your AI coaching dashboard.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/backtests')}
            style={styles.ctaBtn}
          >
            <Text style={styles.ctaBtnText}>Go to Strategy Lab</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Trader Score Card */}
          <View style={styles.scoreCard}>
            <ScoreRing score={data.traderScore} />
            <View style={styles.scoreRight}>
              <View style={styles.styleTag}>
                <Text style={styles.styleTagText}>{data.traderStyle}</Text>
              </View>
              <View style={styles.miniStats}>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatVal}>{data.avgWinRate.toFixed(0)}%</Text>
                  <Text style={styles.miniStatLbl}>Win Rate</Text>
                </View>
                <View style={styles.miniStatDivider} />
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatVal}>{data.avgSharpe.toFixed(1)}</Text>
                  <Text style={styles.miniStatLbl}>Sharpe</Text>
                </View>
                <View style={styles.miniStatDivider} />
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatVal, { color: colors.error }]}>
                    -{data.avgDrawdown.toFixed(0)}%
                  </Text>
                  <Text style={styles.miniStatLbl}>Max DD</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/trader-dna')} style={styles.dnaLink}>
                <Text style={styles.dnaLinkText}>Full DNA →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* AI Coach Insights */}
          {data.insights && data.insights.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Ionicons name="sparkles" size={14} color="#A78BFA" />
                <Text style={styles.sectionTitle}>AI Coach</Text>
              </View>
              {data.insights.slice(0, 2).map((ins, i) => (
                <View key={i} style={styles.insightCard}>
                  <View style={styles.insightBadge}>
                    <Text style={styles.insightBadgeText}>+{ins.improvementPct}%</Text>
                  </View>
                  <Text style={styles.insightText}>{ins.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Mistake Alerts */}
          {data.mistakes && data.mistakes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Ionicons name="warning-outline" size={14} color={colors.warning} />
                <Text style={styles.sectionTitle}>Mistake Alerts</Text>
              </View>
              <View style={styles.mistakeCard}>
                {data.mistakes.slice(0, 3).map((m, i) => (
                  <View key={i}>
                    {i > 0 && <View style={styles.mistakeDivider} />}
                    <View style={styles.mistakeRow}>
                      <MistakeSeverityDot severity={m.severity} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mistakeLabel}>{m.label}</Text>
                        <Text style={styles.mistakeDetail} numberOfLines={2}>{m.detail}</Text>
                      </View>
                      <View style={[styles.severityBadge, {
                        backgroundColor: m.severity === 'high' ? colors.errorDim : m.severity === 'medium' ? colors.warningDim : 'rgba(113,113,122,0.12)',
                      }]}>
                        <Text style={[styles.severityText, {
                          color: m.severity === 'high' ? colors.error : m.severity === 'medium' ? colors.warning : colors.foregroundSubtle,
                        }]}>
                          {m.severity}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
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
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: colors.radius,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
  },
  scoreRight: { flex: 1, gap: 10 },
  styleTag: {
    alignSelf: 'flex-start',
    backgroundColor: PURPLE_DIM,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
  },
  styleTagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#A78BFA',
  },
  miniStats: { flexDirection: 'row', alignItems: 'center' },
  miniStat: { flex: 1, alignItems: 'center', gap: 2 },
  miniStatVal: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.foreground,
  },
  miniStatLbl: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: colors.foregroundSubtle,
  },
  miniStatDivider: { width: 1, height: 24, backgroundColor: colors.border },
  dnaLink: { alignSelf: 'flex-start' },
  dnaLinkText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#A78BFA',
  },
  section: { gap: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.foreground,
  },
  insightCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  insightBadge: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    flexShrink: 0,
  },
  insightBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: colors.success,
  },
  insightText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.foregroundMuted,
    flex: 1,
    lineHeight: 19,
  },
  mistakeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mistakeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
  },
  mistakeDivider: { height: 1, backgroundColor: colors.border, marginLeft: 14 },
  mistakeLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.foreground,
    marginBottom: 2,
  },
  mistakeDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.foregroundSubtle,
    lineHeight: 17,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  severityText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    textTransform: 'capitalize',
  },
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
