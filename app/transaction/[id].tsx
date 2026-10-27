import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTransaction } from '@/src/db/repository/transactions';
import { EntryForm } from '@/src/components/EntryForm';
import { useQuery } from '@/src/hooks/useQuery';
import { fontSize, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { data, loading } = useQuery((db) => (id ? getTransaction(db, id) : Promise.resolve(null)), [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} />
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.text, fontSize: fontSize.title }}>这笔记录已不存在</Text>
          <Text
            onPress={() => router.back()}
            style={{ color: theme.primary, marginTop: spacing.md, fontSize: fontSize.body }}>
            返回
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
      <EntryForm transaction={data} onDone={() => router.back()} />
    </SafeAreaView>
  );
}
