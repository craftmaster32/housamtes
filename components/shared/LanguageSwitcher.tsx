import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@stores/languageStore';
import type { AppLanguage } from '@lib/i18n';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface LanguageOption {
  code: AppLanguage;
  label: string;
  flag: string;
}

// A compact "globe + current language" chip that opens a small menu to switch the
// whole app language on the spot. Dropped onto the pre-login flow (welcome/signup)
// so people can pick the language they want the signup, tour and terms in — even
// when it differs from their phone's language. The choice is global and persisted,
// so it carries through the rest of the flow.
export function LanguageSwitcher(): React.JSX.Element {
  const { t } = useTranslation();
  const currentLanguage = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [open, setOpen] = useState(false);

  const options: LanguageOption[] = useMemo(
    () => [
      { code: 'en', label: t('settings.language_en'), flag: '🇬🇧' },
      { code: 'es', label: t('settings.language_es'), flag: '🇪🇸' },
      { code: 'he', label: t('settings.language_he'), flag: '🇮🇱' },
    ],
    [t]
  );
  const current = options.find((o) => o.code === currentLanguage) ?? options[0];

  const handleSelect = useCallback(
    (code: AppLanguage): void => {
      setOpen(false);
      if (code !== currentLanguage) setLanguage(code);
    },
    [currentLanguage, setLanguage]
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        hitSlop={8}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('common.change_language')}
        accessibilityValue={{ text: current.label }}
      >
        <Ionicons name="language" size={ms(16)} color="#fff" />
        <Text style={styles.chipText}>{current.label}</Text>
        <Ionicons name="chevron-down" size={ms(14)} color="rgba(255,255,255,0.85)" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.centerer} pointerEvents="box-none">
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>{t('common.change_language')}</Text>
            {options.map((opt, idx) => {
              const selected = opt.code === currentLanguage;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => handleSelect(opt.code)}
                  style={({ pressed }) => [
                    styles.row,
                    idx < options.length - 1 && styles.rowBorder,
                    pressed && styles.rowPressed,
                  ]}
                  accessible
                  accessibilityRole="radio"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={styles.flag}>{opt.flag}</Text>
                  <Text style={[styles.rowLabel, selected && styles.rowLabelOn]}>{opt.label}</Text>
                  {selected && <Ionicons name="checkmark" size={ms(20)} color={C.primary} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      paddingVertical: ms(8),
      paddingHorizontal: sizes.md,
      borderRadius: sizes.borderRadiusFull,
      backgroundColor: 'rgba(255,255,255,0.18)',
      minHeight: ms(36),
    },
    chipPressed: { backgroundColor: 'rgba(255,255,255,0.28)' },
    chipText: { fontSize: mf(14), ...font.semibold, color: '#fff' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    centerer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ms(24) },
    menu: {
      width: '100%',
      maxWidth: ms(320),
      borderRadius: ms(16),
      backgroundColor: C.surface,
      paddingVertical: sizes.sm,
      overflow: 'hidden',
    },
    menuTitle: {
      fontSize: mf(13),
      ...font.semibold,
      color: C.textSecondary,
      paddingHorizontal: sizes.md,
      paddingTop: sizes.xs,
      paddingBottom: sizes.sm,
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.md,
      paddingHorizontal: sizes.md,
      paddingVertical: ms(14),
    },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    rowPressed: { backgroundColor: C.background },
    flag: { fontSize: mf(22) },
    rowLabel: { flex: 1, fontSize: mf(15), ...font.medium, color: C.textPrimary },
    rowLabelOn: { color: C.primary, ...font.bold },
  });
}
