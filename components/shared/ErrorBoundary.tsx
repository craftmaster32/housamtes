import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import i18next from 'i18next';
import { captureError } from '@lib/errorTracking';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
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
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>{i18next.t('common.something_went_wrong')}</Text>
          <Text style={styles.message}>
            {i18next.t('common.error_boundary_message')}
          </Text>
          <Pressable
            onPress={this.handleRetry}
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
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sizes.xl,
    backgroundColor: colors.background,
    gap: sizes.md,
  },
  icon: { fontSize: 52 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center' },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: sizes.sm,
    backgroundColor: colors.primary,
    paddingVertical: sizes.sm,
    paddingHorizontal: sizes.xl,
    borderRadius: 14,
  },
  retryText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
