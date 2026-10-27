import '../global.css';

import { Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text, View } from 'react-native';

import { DATABASE_NAME, initializeDatabase } from '@/src/db/initialize';
import { useAppBootstrap } from '@/src/hooks/useAppBootstrap';
import { useAppStore } from '@/src/store/app';
import { radius, spacing, type Theme as Tokens } from '@/src/theme/tokens';
import { useResolvedScheme, useTheme } from '@/src/theme/useTheme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { anchor: '(tabs)' };

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // 金额用等宽数字字体：Android 系统字体（Roboto）没有 tnum 字形，
  // fontVariant: tabular-nums 在 Android 上不可靠，只有真等宽字体能保证数字不跳动。
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
        <RootNav />
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

function RootNav() {
  const { status, detail } = useAppBootstrap();
  const scheme = useResolvedScheme();
  const theme = useTheme();
  const themePreference = useAppStore((state) => state.themePreference);

  /**
   * 必须把「原始偏好」交给 NativeWind，而不是解析后的 light/dark。
   *
   * colorScheme.set('dark') 底层写的是原生 Appearance 覆盖，而 useColorScheme()
   * 读回来的正是这个覆盖。之前传解析值意味着永远只会 set 成 'light'/'dark'，
   * 覆盖一旦落下就再也清不掉：用户从「深色」切回「跟随系统」时，
   * useResolvedScheme 里的 system 拿到的还是刚被强制的深色，界面就卡在深色不动了。
   * 传 'system' 时 NativeWind 会 setColorScheme('unspecified') 把覆盖清掉。
   */
  useEffect(() => {
    colorScheme.set(themePreference);
  }, [themePreference]);

  if (status === 'loading') return null;
  if (status === 'error') return <BootFailure detail={detail} />;

  return (
    <ThemeProvider value={toNavTheme(theme, scheme)}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entry" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="accounts" options={{ headerShown: false }} />
        <Stack.Screen name="accounts/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="categories" options={{ headerShown: false }} />
        <Stack.Screen name="budget" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="export-import" options={{ headerShown: false }} />
        <Stack.Screen name="sponsor" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

function BootFailure({ detail }: { detail: string | null }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        backgroundColor: theme.background,
      }}>
      <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>数据库打不开</Text>
      <Text
        style={{
          color: theme.textMuted,
          marginTop: spacing.md,
          marginBottom: spacing.lg,
          textAlign: 'center',
          backgroundColor: theme.surface,
          padding: spacing.md,
          borderRadius: radius.field,
        }}>
        {detail ?? '未知错误'}
      </Text>
    </View>
  );
}

/** 导航容器（headers、modal 背景）用的主题，和我们自己的 token 保持同源 */
function toNavTheme(theme: Tokens, scheme: 'light' | 'dark'): Theme {
  return {
    dark: scheme === 'dark',
    fonts: {} as Theme['fonts'],
    colors: {
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.divider,
      notification: theme.expense,
    },
  };
}
