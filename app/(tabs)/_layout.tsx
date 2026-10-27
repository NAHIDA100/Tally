import { Tabs } from 'expo-router';

import { AppTabBar } from '@/src/components/AppTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: '首页' }} />
      <Tabs.Screen name="bills" options={{ title: '账单' }} />
      <Tabs.Screen name="stats" options={{ title: '统计' }} />
      <Tabs.Screen name="me" options={{ title: '我的' }} />
    </Tabs>
  );
}
