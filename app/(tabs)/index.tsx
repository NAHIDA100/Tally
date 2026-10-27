import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, View } from 'react-native';

import { getMonthSummary } from '@/src/db/repository/transactions';
import { formatMonthTitle, monthKeyOf } from '@/src/logic/date';
import { useQuery } from '@/src/hooks/useQuery';
import { Money } from '@/src/components/Money';
import { Screen } from '@/src/components/Screen';
import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

function greeting(hour: number): string {
  if (hour < 5) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export default function HomeScreen() {
  const theme = useTheme();
  const now = new Date();
  const month = monthKeyOf(now);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: fontSize.headline, fontWeight: '700', color: theme.text, marginTop: spacing.md }}>
          {greeting(now.getHours())}
        </Text>

        <BalanceCard month={month} />
      </ScrollView>
    </Screen>
  );
}

function BalanceCard({ month }: { month: string }) {
  const theme = useTheme();
  const { data, loading, error } = useQuery((db) => getMonthSummary(db, month), [month]);
  const onCard = theme.textOnGradient;

  return (
    <LinearGradient
      colors={[theme.gradientFrom, theme.gradientTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ marginTop: spacing.lg, borderRadius: radius.card, padding: spacing.xl }}>
      <Text style={{ color: onCard, opacity: 0.85, fontSize: fontSize.body }}>
        {formatMonthTitle(month)}结余
      </Text>
      <Money
        value={data?.net ?? 0}
        signed
        style={{ color: onCard, fontSize: fontSize.amount, fontWeight: '700', marginTop: spacing.xs }}
      />
      {loading || error ? null : (
        <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
          <Stat label="收入" value={data?.income ?? 0} onColor={onCard} />
          <Stat label="支出" value={data?.expense ?? 0} onColor={onCard} />
          <Stat label="笔数" value={data?.count ?? 0} plain onColor={onCard} />
        </View>
      )}
    </LinearGradient>
  );
}

function Stat({ label, value, plain, onColor }: { label: string; value: number; plain?: boolean; onColor: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: onColor, opacity: 0.8, fontSize: fontSize.caption }}>{label}</Text>
      {plain ? (
        <Text style={{ color: onColor, fontSize: fontSize.title, fontWeight: '600', marginTop: 2 }}>
          {value}
        </Text>
      ) : (
        <Money value={value} style={{ color: onColor, fontSize: fontSize.title, fontWeight: '600', marginTop: 2 }} />
      )}
    </View>
  );
}
