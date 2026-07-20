import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import i18next from 'i18next';
import { captureError } from '@lib/errorTracking';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

// Themed fallback — a function component so it can read the active theme via
// hooks (the class boundary below cannot).
function ErrorFallback({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{i18next.t('common.something_went_wrong')}</Text>
      <Text style={styles.message}>{i18next.t('common.error_boundary_message')}</Text>
      <Pressable
        onPress={onRetry}
        style={styles.retryBtn}
        accessible
        accessibilityRole="button"
        accessibilityLabel={i18next.t('common.retry')}
      >
        <Text style={styles.retryText}>{i18next.t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { hasError: true, errorMessage: message };
  }

  override componentDidCatch(error: unknown): void {
    captureError(error, { context: 'error-boundary' });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: sizes.xl,
      backgroundColor: C.background,
      gap: sizes.md,
    },
    icon: { fontSize: 52 },
    title: { fontSize: 22, fontWeight: 'bold', color: C.textPrimary, textAlign: 'center' },
    message: {
      fontSize: 15,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    retryBtn: {
      marginTop: sizes.sm,
      backgroundColor: C.primary,
      paddingVertical: sizes.sm,
      paddingHorizontal: sizes.xl,
      borderRadius: 14,
    },
    retryText: { color: C.white, fontSize: 16, fontWeight: '600' },
  });
