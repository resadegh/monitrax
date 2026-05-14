import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Severity } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MOCK_INSIGHTS = [
  { id: '1', severity: 'critical' as const, title: 'Cashflow shortfall in 5 days', description: 'Projected deficit of $420 based on upcoming loan repayment and utility bills.', time: '2 hours ago' },
  { id: '2', severity: 'high' as const, title: 'ANZ connection needs attention', description: 'Your bank connection expired. Tap to reconnect and resume transaction sync.', time: '4 hours ago' },
  { id: '3', severity: 'high' as const, title: 'Unusual transaction detected', description: '$450 at 2:47 AM from a merchant you\'ve never used before.', time: '6 hours ago' },
  { id: '4', severity: 'medium' as const, title: 'Netflix price increased', description: 'Your subscription went from $16.99 to $22.99/month. That\'s $72/year more.', time: 'Yesterday' },
  { id: '5', severity: 'medium' as const, title: 'You\'re spending more than usual', description: 'Food & dining is 34% above your monthly average this week.', time: 'Yesterday' },
  { id: '6', severity: 'low' as const, title: 'Offset account opportunity', description: 'Redirecting your savings balance could save $2,400/year in interest.', time: '2 days ago' },
];

function AlertCard({ severity, title, description, time, colors }: {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  time: string;
  colors: typeof Colors.light;
}) {
  const color = Severity[severity];
  return (
    <TouchableOpacity activeOpacity={0.7}>
      <View style={[styles.alertCard, { backgroundColor: color + '10', borderLeftColor: color }]}>
        <View style={styles.alertHeader}>
          <View style={styles.badgeRow}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={[styles.severityLabel, { color }]}>{severity.toUpperCase()}</Text>
          </View>
          <Text style={[styles.time, { color: colors.textTertiary }]}>{time}</Text>
        </View>
        <Text style={[styles.alertTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.alertDesc, { color: colors.textSecondary }]} numberOfLines={2}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AlertsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const critical = MOCK_INSIGHTS.filter(i => i.severity === 'critical');
  const high = MOCK_INSIGHTS.filter(i => i.severity === 'high');
  const other = MOCK_INSIGHTS.filter(i => i.severity !== 'critical' && i.severity !== 'high');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Alerts & Insights</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {MOCK_INSIGHTS.length} active · {critical.length} critical
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {critical.length > 0 && (
          <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: Severity.critical }]}>Needs Attention</Text>
            {critical.map(i => <AlertCard key={i.id} {...i} colors={colors} />)}
          </View>
        )}
        {high.length > 0 && (
          <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: Severity.high }]}>Important</Text>
            {high.map(i => <AlertCard key={i.id} {...i} colors={colors} />)}
          </View>
        )}
        {other.length > 0 && (
          <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>Other</Text>
            {other.map(i => <AlertCard key={i.id} {...i} colors={colors} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  scroll: { padding: 16, paddingTop: 8 },
  group: { marginBottom: 20 },
  groupTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  alertCard: { borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3 },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  severityLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  time: { fontSize: 11 },
  alertTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  alertDesc: { fontSize: 13, lineHeight: 18 },
});
