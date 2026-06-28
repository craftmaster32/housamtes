import React from 'react';
import { Platform, View, TextInput as RNTextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';

interface DateInputProps {
  value: string; // YYYY-MM-DD or empty string
  onChange: (val: string) => void;
  style?: object;
}

export function DateInput({ value, onChange, style }: DateInputProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const inputRef = React.useRef<{ showPicker?: () => void } | null>(null);

  if (Platform.OS === 'web') {
    const localeMap: Record<string, string> = { en: 'en-GB', es: 'es-ES', he: 'he-IL' };
    const displayText = value
      ? new Date(value + 'T00:00:00').toLocaleDateString(localeMap[i18n.language] ?? 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : t('common.pick_date');

    return React.createElement(
      'div',
      {
        onClick: () => inputRef.current?.showPicker?.(),
        style: {
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: colors.white,
          borderRadius: '10px',
          border: `1px solid ${colors.border}`,
          padding: `11px ${sizes.md}px`,
          cursor: 'pointer',
          userSelect: 'none',
          boxSizing: 'border-box',
          ...(style as React.CSSProperties || {}),
        },
      },
      React.createElement('span', { style: { fontSize: '14px', lineHeight: 1 } }, '📅'),
      React.createElement(
        'span',
        {
          style: {
            fontSize: `${sizes.fontSm}px`,
            color: value ? colors.textPrimary : colors.textSecondary,
            fontFamily: 'Inter_500Medium, Inter, system-ui, sans-serif',
          },
        },
        displayText
      ),
      // The actual date input — invisible, full-coverage, used only for the picker popup.
      // pointerEvents: 'none' so the div handles all clicks.
      React.createElement('input', {
        ref: (el: unknown) => { inputRef.current = el as { showPicker?: () => void } | null; },
        type: 'date',
        value: value || '',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          pointerEvents: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
        },
      })
    ) as React.JSX.Element;
  }

  return (
    <View style={[styles.container, style as object]}>
      <RNTextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={t('common.pick_date')}
        placeholderTextColor={colors.textDisabled}
        accessibilityLabel={t('bills.pick_date')}
        accessibilityHint={t('bills.date_format_hint')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  input: {
    paddingHorizontal: sizes.sm,
    paddingVertical: sizes.sm,
    fontSize: sizes.fontSm,
    color: colors.textPrimary,
  },
});
