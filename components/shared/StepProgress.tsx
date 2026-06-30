import { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { isRTL } from '@lib/i18n';
import { useLanguageStore } from '@stores/languageStore';

interface Step {
  label: string;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
}

export function StepProgress({ steps, currentStep }: StepProgressProps): React.JSX.Element {
  const C = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const styles = useMemo(() => makeStyles(C, rtl), [C, rtl]);
  const anims = useRef(steps.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = steps.map((_, i) =>
      Animated.spring(anims[i], {
        toValue: 1,
        delay: i * 120,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      })
    );
    Animated.stagger(80, animations).start();
  }, [anims, steps]);

  return (
    <View style={styles.container}>
      {steps.map((step, i) => {
        const isComplete = i < currentStep;
        const isActive = i === currentStep;
        const isFuture = i > currentStep;

        return (
          <View key={step.label} style={styles.stepWrapper}>
            {i > 0 && (
              <View
                style={[
                  styles.line,
                  isComplete || isActive ? styles.lineActive : styles.lineInactive,
                ]}
              />
            )}
            <Animated.View
              style={[
                styles.circle,
                isComplete && styles.circleComplete,
                isActive && styles.circleActive,
                isFuture && styles.circleFuture,
                {
                  transform: [{ scale: anims[i] }],
                  opacity: anims[i],
                },
              ]}
            >
              {isComplete ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Text
                  style={[styles.circleText, (isComplete || isActive) && styles.circleTextActive]}
                >
                  {i + 1}
                </Text>
              )}
            </Animated.View>
            <Text style={[styles.label, (isComplete || isActive) && styles.labelActive]}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(C: ColorTokens, rtl: boolean): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: 0,
      paddingVertical: 8,
    },
    stepWrapper: {
      alignItems: 'center',
      flexDirection: 'column',
      flex: 1,
      position: 'relative',
    },
    line: {
      position: 'absolute',
      top: 16,
      // The row visually flows right-to-left under the inherited RTL `direction`,
      // so the line must extend toward the physical right (where the previous
      // step now sits) instead of always anchoring from the right edge.
      ...(rtl ? { left: '50%' } : { right: '50%' }),
      width: '100%',
      height: 2,
      zIndex: -1,
    },
    lineActive: {
      backgroundColor: C.primary,
    },
    lineInactive: {
      backgroundColor: C.border,
    },
    circle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    circleComplete: {
      backgroundColor: C.primary,
    },
    circleActive: {
      backgroundColor: C.primary,
    },
    circleFuture: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: C.border,
    },
    circleText: {
      fontSize: 13,
      ...font.semibold,
      color: C.textTertiary,
    },
    circleTextActive: {
      color: '#fff',
    },
    label: {
      fontSize: 11,
      ...font.medium,
      color: C.textTertiary,
      marginTop: 6,
    },
    labelActive: {
      color: C.primary,
      ...font.semibold,
    },
  });
}
