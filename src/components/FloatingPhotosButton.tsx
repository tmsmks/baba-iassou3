import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/theme';
import { usePhotosBadge } from '@/hooks/usePhotosBadge';

const STORAGE_KEY = 'floating-photos-btn-pos-v2';
const BTN_SIZE = 56;

export function FloatingPhotosButton() {
  const t = useTheme();
  const { unseenCount } = usePhotosBadge();
  const { width, height } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const minY = headerHeight + 8;
  const maxY = Math.max(minY, height - tabBarHeight - BTN_SIZE - 8);
  const defaultX = width - BTN_SIZE;
  const defaultY = minY + (maxY - minY) / 2;

  const posX = useSharedValue(defaultX);
  const posY = useSharedValue(defaultY);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const snapX = useCallback(
    (x: number) => {
      const centerX = x + BTN_SIZE / 2;
      return centerX < width / 2 ? 0 : width - BTN_SIZE;
    },
    [width],
  );

  useEffect(() => {
    posX.value = defaultX;
    posY.value = defaultY;

    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const { x, y } = JSON.parse(raw) as { x?: number; y?: number };
        if (typeof x === 'number' && typeof y === 'number') {
          posX.value = snapX(x);
          posY.value = Math.min(Math.max(y, minY), maxY);
        }
      } catch {
        // ignore
      }
    });
  }, [posX, posY, snapX, minY, maxY, defaultX, defaultY]);

  const navigate = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/photos');
  }, []);

  const snapAndSave = useCallback(
    (x: number, y: number) => {
      const snappedX = snapX(x);
      const clampedY = Math.min(Math.max(y, minY), maxY);
      posX.value = withSpring(snappedX, { damping: 18, stiffness: 220 });
      posY.value = withSpring(clampedY, { damping: 18, stiffness: 220 });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ x: snappedX, y: clampedY })).catch(() => {});
    },
    [snapX, minY, maxY, posX, posY],
  );

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(navigate)();
  });

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onStart(() => {
      startX.value = posX.value;
      startY.value = posY.value;
    })
    .onUpdate((e) => {
      posX.value = startX.value + e.translationX;
      posY.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(snapAndSave)(posX.value, posY.value);
    });

  const gesture = Gesture.Exclusive(tap, pan);

  const animStyle = useAnimatedStyle(() => ({
    left: posX.value,
    top: posY.value,
  }));

  const iconColor = t.isDark ? t.bg : '#FFFFFF';
  const badgeLabel = unseenCount > 99 ? '99+' : String(unseenCount);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.btn, { backgroundColor: t.primary }, animStyle]}
          accessibilityLabel={
            unseenCount > 0
              ? `Mur photos, ${unseenCount} nouvelle${unseenCount > 1 ? 's' : ''} photo${unseenCount > 1 ? 's' : ''}`
              : 'Mur photos'
          }
          accessibilityRole="button"
        >
          <Ionicons name="camera" size={24} color={iconColor} />
          {unseenCount > 0 ? (
            <View style={[styles.badge, { borderColor: t.primary }]}>
              <Text style={styles.badgeTxt}>{badgeLabel}</Text>
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  btn: {
    position: 'absolute',
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  badgeTxt: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
