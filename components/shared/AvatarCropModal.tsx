import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, StyleSheet, Pressable, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onConfirm: (uri: string, base64: string) => void;
  onCancel: () => void;
}

const CIRCLE = 280;
const OVERLAY = 'rgba(0,0,0,0.72)';
const { width: SW } = Dimensions.get('window');

export function AvatarCropModal({ visible, imageUri, imageWidth, imageHeight, onConfirm, onCancel }: Props): React.JSX.Element {
  const [processing, setProcessing] = useState(false);
  const [cropAreaH, setCropAreaH] = useState(0);

  // Scale so image just covers the crop circle at zoom=1
  const coverScale = imageWidth > 0 && imageHeight > 0
    ? Math.max(CIRCLE / imageWidth, CIRCLE / imageHeight)
    : 1;
  const displayW = imageWidth * coverScale;
  const displayH = imageHeight * coverScale;

  const scaleVal = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scaleVal.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedX.value = 0;
      savedY.value = 0;
    }
  }, [visible, scaleVal, savedScale, translateX, translateY, savedX, savedY]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      scaleVal.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scaleVal.value;
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const s = scaleVal.value;
      const maxX = Math.max(0, (displayW * s - CIRCLE) / 2);
      const maxY = Math.max(0, (displayH * s - CIRCLE) / 2);
      translateX.value = Math.min(maxX, Math.max(-maxX, savedX.value + e.translationX));
      translateY.value = Math.min(maxY, Math.max(-maxY, savedY.value + e.translationY));
    })
    .onEnd(() => {
      'worklet';
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scaleVal.value },
    ],
  }));

  const handleConfirm = useCallback(async (): Promise<void> => {
    setProcessing(true);
    try {
      // scaleVal gives user zoom on top of coverScale
      const s = savedScale.value * coverScale;
      const tx = savedX.value;
      const ty = savedY.value;

      const cropCenterX = imageWidth / 2 - tx / s;
      const cropCenterY = imageHeight / 2 - ty / s;
      const cropSize = CIRCLE / s;

      const originX = Math.round(Math.max(0, cropCenterX - cropSize / 2));
      const originY = Math.round(Math.max(0, cropCenterY - cropSize / 2));
      const width = Math.round(Math.min(cropSize, imageWidth - originX));
      const height = Math.round(Math.min(cropSize, imageHeight - originY));

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          { crop: { originX, originY, width, height } },
          { resize: { width: 512, height: 512 } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      onConfirm(result.uri, result.base64 ?? '');
    } catch {
      onCancel();
    } finally {
      setProcessing(false);
    }
  }, [imageUri, imageWidth, imageHeight, coverScale, onConfirm, onCancel,
    savedScale, savedX, savedY]);

  const sideW = Math.max(0, (SW - CIRCLE) / 2);
  const topH = cropAreaH > 0 ? Math.max(0, (cropAreaH - CIRCLE) / 2) : 0;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onCancel} disabled={processing} accessibilityRole="button" style={styles.headerSide}>
            <Text style={styles.headerBtn}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Adjust Photo</Text>
          <View style={styles.headerSide}>
            {processing
              ? <ActivityIndicator size="small" color={colors.primary} />
              : (
                <Pressable onPress={handleConfirm} accessibilityRole="button">
                  <Text style={[styles.headerBtn, styles.headerBtnPrimary]}>Use Photo</Text>
                </Pressable>
              )
            }
          </View>
        </View>

        {/* Crop area */}
        <View
          style={styles.cropArea}
          onLayout={(e) => setCropAreaH(e.nativeEvent.layout.height)}
        >
          {/* Gesture-controlled image, centered */}
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.imageWrap, animStyle]}>
              <Image
                source={{ uri: imageUri }}
                style={{ width: displayW, height: displayH }}
                contentFit="fill"
              />
            </Animated.View>
          </GestureDetector>

          {/* Dark overlay framing the crop circle — transparent hole shows image */}
          {cropAreaH > 0 && (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {/* Top strip */}
              <View style={[styles.overlayStrip, { height: topH }]} />
              {/* Middle row */}
              <View style={{ flexDirection: 'row', height: CIRCLE }}>
                <View style={[styles.overlayStrip, { width: sideW }]} />
                {/* Transparent circle hole — image shows through */}
                <View style={styles.circleHole} />
                <View style={[styles.overlayStrip, { flex: 1 }]} />
              </View>
              {/* Bottom strip */}
              <View style={[styles.overlayStrip, { flex: 1 }]} />
              {/* White circle border */}
              <View style={[styles.circleBorder, { top: topH, left: sideW }]} />
            </View>
          )}
        </View>

        <Text style={styles.hint}>Pinch to zoom · Drag to reposition</Text>
      </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  headerSide: { width: 90, alignItems: 'flex-end' },
  headerTitle: { color: '#fff', fontSize: 16, ...font.semibold },
  headerBtn: { color: '#ccc', fontSize: 15, ...font.regular },
  headerBtnPrimary: { color: colors.primary, ...font.semibold },

  cropArea: {
    flex: 1,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: { alignItems: 'center', justifyContent: 'center' },

  overlayStrip: { backgroundColor: OVERLAY },
  circleHole: { width: CIRCLE, height: CIRCLE },
  circleBorder: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },

  hint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    ...font.regular,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
