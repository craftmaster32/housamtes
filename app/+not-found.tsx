import { useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

export default function NotFoundScreen(): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="map-outline" size={48} color={C.textSecondary} />
        </View>
        <Text style={styles.code}>404</Text>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.message}>
          {"This screen doesn't exist. Let's get you back home."}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
          onPress={() => router.replace('/(tabs)/dashboard')}
          accessibilityRole="button"
          accessibilityLabel="Go to dashboard"
        >
          <Ionicons name="home-outline" size={18} color="#fff" />
          <Text style={styles.btnText}>Go to Dashboard</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: sizes.xl,
      gap: sizes.md,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: C.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: sizes.sm,
    },
    code: {
      fontSize: 72,
      ...font.extrabold,
      color: C.textSecondary,
      letterSpacing: -2,
      lineHeight: 80,
    },
    title: { fontSize: 22, ...font.bold, color: C.textPrimary, letterSpacing: -0.3 },
    message: {
      fontSize: 15,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 280,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.primary,
      paddingHorizontal: sizes.lg,
      paddingVertical: 14,
      borderRadius: 14,
      marginTop: sizes.sm,
    },
    btnText: { fontSize: 16, ...font.semibold, color: '#fff' },
  });
}
