import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/src/components/Screen';
import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

type RowIcon = 'folder-account-outline' | 'tag-multiple-outline' | 'target-account' | 'cog-outline' | 'heart-outline';
type RowHref = '/accounts' | '/categories' | '/budget' | '/settings' | '/sponsor';

export default function MeScreen() {
  const theme = useTheme();
  return (
    <Screen>
      <Text style={{ color: theme.text, fontSize: fontSize.headline, fontWeight: '700', marginTop: spacing.md }}>
        我的
      </Text>

      <Section title="管理" theme={theme}>
        <LinkRow icon="folder-account-outline" label="账户" href="/accounts" />
        <Divider theme={theme} />
        <LinkRow icon="tag-multiple-outline" label="分类" href="/categories" />
        <Divider theme={theme} />
        <LinkRow icon="target-account" label="预算" href="/budget" />
      </Section>

      <Section title="偏好" theme={theme}>
        <LinkRow icon="cog-outline" label="设置" href="/settings" />
      </Section>

      <Section title="支持" theme={theme}>
        <LinkRow icon="heart-outline" label="赞助开发者" href="/sponsor" />
      </Section>
    </Screen>
  );
}

function Section({ title, theme, children }: { title: string; theme: ReturnType<typeof useTheme>; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, marginBottom: spacing.sm }}>{title}</Text>
      <View style={{ backgroundColor: theme.surface, borderRadius: radius.card }}>{children}</View>
    </View>
  );
}

function Divider({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return <View style={{ height: 1, backgroundColor: theme.divider, marginLeft: spacing.xl }} />;
}

function LinkRow({ icon, label, href }: { icon: RowIcon; label: string; href: RowHref }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg }}>
      <MaterialCommunityIcons name={icon} size={22} color={theme.textMuted} />
      <Text style={{ color: theme.text, fontSize: fontSize.body, flex: 1 }}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={18} color={theme.divider} />
    </Pressable>
  );
}
