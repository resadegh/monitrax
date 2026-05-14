import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Brand } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function TriageCard({ merchant, amount, category, confidence, colors }: {
  merchant: string;
  amount: string;
  category: string;
  confidence: number;
  colors: typeof Colors.light;
}) {
  return (
    <View style={[styles.triageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.swipeHint, { color: colors.textTertiary }]}>← Flag</Text>
      <View style={styles.triageContent}>
        <Text style={[styles.merchantName, { color: colors.text }]}>{merchant}</Text>
        <Text style={[styles.triageAmount, { color: colors.text }]}>{amount}</Text>
        <Text style={[styles.triageAccount, { color: colors.textSecondary }]}>ANZ Everyday</Text>
        <Text style={[styles.triageDate, { color: colors.textTertiary }]}>Today, 2:14 PM</Text>
        <View style={styles.suggestionPill}>
          <Text style={[styles.suggestionText, { color: Brand.emerald }]}>
            {category} ({Math.round(confidence * 100)}%)
          </Text>
        </View>
      </View>
      <Text style={[styles.swipeHint, { color: colors.textTertiary }]}>Accept →</Text>
    </View>
  );
}

export default function TriageScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Transaction Triage</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          12 transactions need your input
        </Text>
      </View>

      <View style={styles.cardStack}>
        <View style={[styles.stackCard2, { backgroundColor: colors.surface, borderColor: colors.border }]} />
        <View style={[styles.stackCard1, { backgroundColor: colors.surface, borderColor: colors.border }]} />
        <TriageCard
          merchant="WOOLWORTHS METRO 0432"
          amount="-$82.50"
          category="Groceries"
          confidence={0.85}
          colors={colors}
        />
      </View>

      <View style={styles.queueIndicator}>
        {[...Array(7)].map((_, i) => (
          <View
            key={i}
            style={[styles.dot, {
              backgroundColor: i === 4 ? Brand.emerald : colors.border,
              width: i === 4 ? 10 : 6,
              height: i === 4 ? 10 : 6,
            }]}
          />
        ))}
      </View>

      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        Swipe right to accept  ·  Swipe left to flag  ·  Swipe up to investigate
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  cardStack: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  stackCard2: { position: 'absolute', width: '88%', height: 280, borderRadius: 20, borderWidth: 0.5, opacity: 0.4, transform: [{ scale: 0.9 }, { translateY: -16 }] },
  stackCard1: { position: 'absolute', width: '94%', height: 280, borderRadius: 20, borderWidth: 0.5, opacity: 0.7, transform: [{ scale: 0.95 }, { translateY: -8 }] },
  triageCard: { width: '100%', borderRadius: 20, padding: 24, borderWidth: 0.5, alignItems: 'center', minHeight: 280, justifyContent: 'space-between', flexDirection: 'row', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  swipeHint: { fontSize: 12, fontWeight: '500', width: 50, textAlign: 'center' },
  triageContent: { flex: 1, alignItems: 'center' },
  merchantName: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  triageAmount: { fontSize: 32, fontWeight: '700', marginBottom: 8 },
  triageAccount: { fontSize: 14, marginBottom: 2 },
  triageDate: { fontSize: 13, marginBottom: 16 },
  suggestionPill: { backgroundColor: Brand.emerald + '15', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  suggestionText: { fontSize: 14, fontWeight: '600' },
  queueIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 16 },
  dot: { borderRadius: 5 },
  hint: { textAlign: 'center', fontSize: 12, paddingBottom: 16, paddingHorizontal: 24 },
});
