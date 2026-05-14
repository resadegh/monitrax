import { ScrollView, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';

import { Colors, Brand } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function StatCard({ label, value, subtitle, positive, colors }: {
  label: string;
  value: string;
  subtitle?: string;
  positive?: boolean;
  colors: typeof Colors.light;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.cardValue, {
        color: positive === undefined ? colors.text
          : positive ? colors.positive : colors.critical
      }]}>{value}</Text>
      {subtitle && (
        <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
      )}
    </View>
  );
}

function HealthRing({ score, grade, colors }: {
  score: number;
  grade: string;
  colors: typeof Colors.light;
}) {
  const ringColor = score >= 60 ? Brand.emerald : score >= 40 ? Brand.amber : Brand.red;
  return (
    <View style={styles.healthRing}>
      <View style={[styles.ringOuter, { borderColor: colors.border }]}>
        <View style={[styles.ringFill, { borderColor: ringColor }]} />
        <View style={styles.ringCenter}>
          <Text style={[styles.ringScore, { color: colors.text }]}>{score}</Text>
          <Text style={[styles.ringGrade, { color: ringColor }]}>{grade}</Text>
        </View>
      </View>
    </View>
  );
}

function PaydayWidget({ amount, days, colors }: {
  amount: string;
  days: number;
  colors: typeof Colors.light;
}) {
  const urgency = days > 14 ? Brand.emerald : days > 7 ? Brand.amber : Brand.red;
  return (
    <View style={[styles.paydayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.paydayAmount, { color: urgency }]}>{amount}</Text>
      <Text style={[styles.paydayLabel, { color: colors.textSecondary }]}>
        left for {days} days until payday
      </Text>
      <View style={[styles.paydayBar, { backgroundColor: colors.border }]}>
        <View style={[styles.paydayFill, { backgroundColor: urgency, width: `${Math.min((days / 30) * 100, 100)}%` }]} />
      </View>
    </View>
  );
}

function InsightCard({ severity, title, description, colors }: {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  colors: typeof Colors.light;
}) {
  const severityColors = { critical: '#DC2626', high: '#EA580C', medium: '#F59E0B', low: '#3B82F6' };
  const severityColor = severityColors[severity];
  return (
    <View style={[styles.insightCard, {
      backgroundColor: severityColor + '10',
      borderLeftColor: severityColor,
    }]}>
      <View style={styles.insightBadge}>
        <View style={[styles.insightDot, { backgroundColor: severityColor }]} />
        <Text style={[styles.insightSeverity, { color: severityColor }]}>
          {severity.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.insightTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.insightDesc, { color: colors.textSecondary }]} numberOfLines={2}>
        {description}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.emerald} />}
      >
        <Text style={[styles.greeting, { color: colors.textSecondary }]}>Good morning</Text>

        <View style={styles.heroSection}>
          <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Net Worth</Text>
          <Text style={[styles.heroValue, { color: colors.text }]}>$1,247,320</Text>
          <Text style={[styles.heroChange, { color: Brand.emerald }]}>+2.3% this month</Text>
        </View>

        <PaydayWidget amount="$1,240" days={8} colors={colors} />

        <View style={styles.cardRow}>
          <StatCard label="Monthly Cashflow" value="+$2,340" subtitle="↑ 12% vs last month" positive={true} colors={colors} />
          <StatCard label="Today's Spend" value="$82.50" subtitle="vs $95 daily avg" colors={colors} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Health Score</Text>
          </View>
          <View style={[styles.healthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <HealthRing score={78} grade="B+" colors={colors} />
            <View style={styles.healthMeta}>
              <Text style={[styles.healthTrend, { color: Brand.emerald }]}>↑ Improving</Text>
              <Text style={[styles.healthDetail, { color: colors.textSecondary }]}>Liquidity: strong</Text>
              <Text style={[styles.healthDetail, { color: colors.textSecondary }]}>Debt: watch</Text>
              <Text style={[styles.healthDetail, { color: colors.textSecondary }]}>Cashflow: strong</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Insights</Text>
          <InsightCard
            severity="high"
            title="Cashflow shortfall in 5 days"
            description="Projected deficit of $420 based on upcoming loan repayment."
            colors={colors}
          />
          <InsightCard
            severity="medium"
            title="Netflix price increased"
            description="Your subscription went from $16.99 to $22.99/month."
            colors={colors}
          />
          <InsightCard
            severity="low"
            title="Offset account opportunity"
            description="Redirecting savings could save $2,400/year in interest."
            colors={colors}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  greeting: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  heroSection: { marginBottom: 20 },
  heroLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  heroValue: { fontSize: 40, fontWeight: '700', letterSpacing: -1 },
  heroChange: { fontSize: 14, fontWeight: '500', marginTop: 2 },
  paydayCard: {
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 0.5, alignItems: 'center',
  },
  paydayAmount: { fontSize: 32, fontWeight: '700' },
  paydayLabel: { fontSize: 14, marginTop: 4, marginBottom: 12 },
  paydayBar: { height: 6, borderRadius: 3, width: '100%' },
  paydayFill: { height: 6, borderRadius: 3 },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  card: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 0.5 },
  cardLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  cardValue: { fontSize: 22, fontWeight: '600' },
  cardSubtitle: { fontSize: 12, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  healthCard: { borderRadius: 16, padding: 16, borderWidth: 0.5, flexDirection: 'row', alignItems: 'center' },
  healthRing: { marginRight: 20 },
  ringOuter: { width: 100, height: 100, borderRadius: 50, borderWidth: 8, justifyContent: 'center', alignItems: 'center' },
  ringFill: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 8, borderRightColor: 'transparent', borderBottomColor: 'transparent', transform: [{ rotate: '-45deg' }] },
  ringCenter: { alignItems: 'center' },
  ringScore: { fontSize: 28, fontWeight: '700' },
  ringGrade: { fontSize: 14, fontWeight: '600' },
  healthMeta: { flex: 1 },
  healthTrend: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  healthDetail: { fontSize: 13, marginBottom: 2 },
  insightCard: { borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3 },
  insightBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  insightDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  insightSeverity: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  insightTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  insightDesc: { fontSize: 13, lineHeight: 18 },
});
