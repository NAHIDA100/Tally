import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EntryForm } from '@/src/components/EntryForm';
import { useTheme } from '@/src/theme/useTheme';

export default function EntryScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
      <EntryForm onDone={() => router.back()} />
    </SafeAreaView>
  );
}
