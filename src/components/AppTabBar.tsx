import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/src/components/CategoryIcon';
import { fontSize } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

interface TabItem {
  /** (tabs) 下的路由文件名 */
  name: string;
  label: string;
  icon: IconName;
}

/** Tab 顺序即数组顺序，中间空位留给 FAB。 */
const TABS: TabItem[] = [
  { name: 'index', label: '首页', icon: 'home-variant' },
  { name: 'bills', label: '账单', icon: 'format-list-bulleted' },
  { name: 'stats', label: '统计', icon: 'chart-donut' },
  { name: 'me', label: '我的', icon: 'account-circle-outline' },
];

const BAR_HEIGHT = 62;
const FAB_SIZE = 54;
/** FAB 探出栏顶的高度，对应参考稿中间凸起的效果 */
const FAB_PROTRUSION = 16;

function hrefFor(name: string): Href {
  return (name === 'index' ? '/' : `/${name}`) as Href;
}

interface TabBarProps {
  state: { routes: { name: string }[]; index: number };
}

/**
 * 凸起效果不能靠负 margin：Android 会把超出父容器边界的子视图裁掉，
 * 真机上表现就是「＋」完全不显示。
 * 所以外层给一个更高的透明容器，把栏体和 FAB 都放在它自己的边界内绝对定位。
 * 透明区域用 box-none 放行点击，否则会吃掉列表底部的滑动。
 */
export function AppTabBar({ state }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const focusedName = state.routes[state.index]?.name;

  return (
    <View
      pointerEvents="box-none"
      style={{ height: FAB_PROTRUSION + BAR_HEIGHT + insets.bottom }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.tabBar,
          borderTopWidth: 1,
          borderTopColor: theme.divider,
        }}>
        {TABS.slice(0, 2).map((tab) => (
          <TabButton key={tab.name} tab={tab} focused={focusedName === tab.name} />
        ))}
        <View style={{ width: FAB_SIZE + 22 }} />
        {TABS.slice(2).map((tab) => (
          <TabButton key={tab.name} tab={tab} focused={focusedName === tab.name} />
        ))}
      </View>

      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="记一笔"
          onPress={() => router.push('/entry')}
          android_ripple={{ color: theme.primarySoft, borderless: false }}
          style={{
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.primary,
            borderWidth: 4,
            borderColor: theme.tabBar,
          }}>
          <MaterialCommunityIcons name="plus" size={26} color={theme.textOnPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function TabButton({ tab, focused }: { tab: TabItem; focused: boolean }) {
  const theme = useTheme();
  const color = focused ? theme.primary : theme.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      onPress={() => router.navigate(hrefFor(tab.name))}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <MaterialCommunityIcons name={tab.icon} size={22} color={color} />
      <Text style={{ fontSize: fontSize.caption, color }}>{tab.label}</Text>
    </Pressable>
  );
}
