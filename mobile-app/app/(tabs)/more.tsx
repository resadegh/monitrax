import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Brand } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

function MenuItem({ label, subtitle, colors }: {
  label: string;
  subtitle?: string;
  colors: typeof Colors.light;
}) {
  return (
    <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} activeOpacity={0.6}>
      <View style={[styles.menuIcon, { backgroundColor: Brand.navy + '10' }]}>
        <IconSymbol name="house.fill" size={18} color={Brand.navy} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
        {subtitle && <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>More</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MenuItem label="Transactions" subtitle="Full transaction feed" colors={colors} />
          <MenuItem label="Cashflow Forecast" subtitle="14-day projection" colors={colors} />
          <MenuItem label="Budget vs Actual" subtitle="Monthly progress" colors={colors} />
          <MenuItem label="AI Chat" subtitle="Ask Monitrax anything" colors={colors} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MenuItem label="Notification Preferences" colors={colors} />
          <MenuItem label="Appearance" subtitle={colorScheme === 'dark' ? 'Dark mode' : 'Light mode'} colors={colors} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MenuItem label="Continue on Desktop" subtitle="Open full Monitrax dashboard" colors={colors} />
        </View>

        <TouchableOpacity style={styles.signOut}>
          <Text style={[styles.signOutText, { color: Brand.red }]}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textTertiary }]}>
          Monitrax Mobile v0.1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  scroll: { padding: 16, paddingTop: 8 },
  section: { borderRadius: 12, borderWidth: 0.5, marginBottom: 16, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 0.5 },
  menuIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 16, fontWeight: '500' },
  menuSubtitle: { fontSize: 13, marginTop: 1 },
  signOut: { alignItems: 'center', paddingVertical: 16 },
  signOutText: { fontSize: 16, fontWeight: '500' },
  version: { textAlign: 'center', fontSize: 12, paddingBottom: 32 },
});
