import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { Screen } from '@/src/components/Screen';
import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

const POINTS: { title: string; body: string }[] = [
  {
    title: '开源且免费',
    body: 'Tally 基于 MIT 协议开源，源代码公开，任何人都可以查看、使用和自行编译。',
  },
  {
    title: '所有功能都不收费',
    body: '没有广告、没有会员、没有内购，也不会有任何弹窗或付费提醒。不赞助，各项功能一样完整可用。',
  },
  {
    title: '赞助只是自愿的心意',
    body: '如果这个 App 帮到了你，可以请开发者吃一顿饭。它不会换来任何功能或优先级。',
  },
];

const LINKS: { icon: 'github' | 'video-outline'; label: string; detail: string; url: string }[] = [
  {
    icon: 'github',
    label: '开源仓库',
    detail: 'github.com/NAHIDA100/Tally',
    url: 'https://github.com/NAHIDA100/Tally',
  },
  {
    icon: 'video-outline',
    label: '在 B 站找到开发者',
    detail: 'UID 3546743532686015',
    url: 'https://space.bilibili.com/3546743532686015',
  },
];

export default function SponsorScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  // 页面内边距 + 卡片内边距各两侧，二维码要留出这 64dp 才是卡片的可用宽度。
  // 用像素而不是 '100%'：真机上百分比宽度没能约束住 Image，图片按原始像素（1037）画出来，
  // 把卡片一起撑出了屏幕右边界。像素值不依赖这个行为，稳定。
  const qrSize = Math.round(Math.min(width, 480) - spacing.lg * 4);

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ padding: spacing.xs }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600' }}>赞助开发者</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        {/* 二维码本身是白底的，卡片固定用浅色底才不会在深色主题下糊掉对比度 */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: radius.card,
            padding: spacing.lg,
            alignItems: 'center',
          }}>
          <Image
            source={require('../assets/images/sponsor-qr.jpg')}
            accessibilityLabel="赞赏码二维码"
            resizeMode="contain"
            style={{ width: qrSize, height: qrSize }}
          />
        </View>

        <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, lineHeight: 20 }}>
          用微信或支付宝的「扫一扫」识别上面的二维码，也可以截图后在收款 App 里长按识别。
        </Text>

        {POINTS.map((point) => (
          <View
            key={point.title}
            style={{ backgroundColor: theme.surface, borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm }}>
            <Text style={{ color: theme.text, fontSize: fontSize.body, fontWeight: '600' }}>{point.title}</Text>
            <Text style={{ color: theme.textMuted, fontSize: fontSize.body, lineHeight: 22 }}>{point.body}</Text>
          </View>
        ))}

        <View style={{ backgroundColor: theme.surface, borderRadius: radius.card }}>
          {LINKS.map((link, index) => (
            <View key={link.url}>
              {index > 0 ? <View style={{ height: 1, backgroundColor: theme.divider, marginLeft: spacing.xl }} /> : null}
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(link.url)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg }}>
                <MaterialCommunityIcons name={link.icon} size={22} color={theme.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: fontSize.body }}>{link.label}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: fontSize.caption }}>{link.detail}</Text>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={18} color={theme.divider} />
              </Pressable>
            </View>
          ))}
        </View>

        {/* 整段写在一行：JSX 会把源码里的换行折叠成一个空格，中文中间就多出缝 */}
        <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, lineHeight: 20 }}>
          本应用完全离线，不联网、没有服务端，所以收款也不经过这里 —— 赞赏直接在你自己的收款 App 里完成，开发者收不到你的任何信息。
        </Text>
      </ScrollView>
    </Screen>
  );
}
