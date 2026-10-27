import { Link } from 'expo-router';
import { Text } from 'react-native';

import { Screen } from '@/src/components/Screen';
import { fontSize, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

export default function NotFoundScreen() {
  const theme = useTheme();
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: fontSize.title }}>这个页面不存在</Text>
      <Link href="/" style={{ marginTop: spacing.lg }}>
        <Text style={{ color: theme.primary }}>回到首页</Text>
      </Link>
    </Screen>
  );
}
