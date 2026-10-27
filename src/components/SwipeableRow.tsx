import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Pressable, Text, View } from 'react-native';

import { fontSize, radius } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

const ACTION_WIDTH = 88;
/** 超过这个位移就停在「已展开」，否则弹回；避免半途卡住 */
const REVEAL_THRESHOLD = ACTION_WIDTH * 0.5;

/**
 * 左滑露出删除按钮。
 *
 * 不做「一滑到底直接删」：记账数据除了撤销那几秒之外不可再生，误触代价高，
 * 所以滑动只负责露出按钮，真删要再点一次。
 */
export function SwipeableRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const theme = useTheme();
  const translateX = useSharedValue(0);

  const gesture = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      const next = event.translationX;
      translateX.value = next > 0 ? 0 : Math.max(-ACTION_WIDTH, next);
    })
    .onEnd(() => {
      translateX.value = withSpring(translateX.value < -REVEAL_THRESHOLD ? -ACTION_WIDTH : 0);
    });

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <View>
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: ACTION_WIDTH,
          backgroundColor: theme.danger,
          borderTopRightRadius: radius.field,
          borderBottomRightRadius: radius.field,
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="删除这笔记录"
          onPress={onDelete}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: '#FFFFFF', fontSize: fontSize.body }}>删除</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={contentStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
