import { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { PRESET_COLORS, CATEGORY_PICKER_ICONS } from '@stores/expenseCategoriesStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { PageSheet } from '@components/shared/PageSheet';
import { SheetButton } from '@components/shared/SheetButton';
import { PenCircle } from '@components/shared/PenCircle';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { mf, ms } from '@utils/responsive';

export interface CategoryForm {
  name: string;
  icon: string;
  color: string;
}

interface CategorySheetProps {
  visible: boolean;
  editing: boolean;
  initial: CategoryForm;
  saving: boolean;
  onSave: (form: CategoryForm) => void;
  onClose: () => void;
}

/** Add or edit an expense category: its name on a line, an icon circled in pen, a colour. */
export function CategorySheet({
  visible,
  editing,
  initial,
  saving,
  onSave,
  onClose,
}: CategorySheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const [form, setForm] = useState<CategoryForm>(initial);

  useEffect(() => {
    if (visible) setForm(initial);
    // Only reset when the sheet opens, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const label = (text: string): React.JSX.Element => (
    <Text style={[styles.label, { color: c.textSecondary }]}>{text}</Text>
  );

  return (
    <PageSheet
      visible={visible}
      eyebrow={t('categories.title')}
      title={editing ? t('categories.edit') : t('categories.add_category').replace(/^\+\s*/, '')}
      onClose={onClose}
    >
      <UnderlineInput
        label={t('categories.category_name')}
        value={form.name}
        onChangeText={(v) => setForm((f) => ({ ...f, name: v.slice(0, 30) }))}
        placeholder={t('categories.category_name')}
        autoCapitalize="words"
        accessibilityLabel={t('categories.category_name')}
        accessibilityHint={t('categories.category_name_hint')}
      />

      <View>
        {label(t('categories.choose_icon'))}
        <View style={styles.icons} accessibilityRole="radiogroup">
          {CATEGORY_PICKER_ICONS.map((icon) => {
            const on = form.icon === icon;
            return (
              <Pressable
                key={icon}
                style={styles.icon}
                onPress={() => setForm((f) => ({ ...f, icon }))}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t('categories.icon_option', {
                  name: icon.replace(/-outline$/, '').replace(/-/g, ' '),
                })}
              >
                {on && <PenCircle color={c.primary} style={styles.ring} strokeWidth={2} />}
                <Ionicons name={icon} size={21} color={on ? form.color : c.textSecondary} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.colors} accessibilityRole="radiogroup">
        {PRESET_COLORS.map((col) => {
          const on = form.color === col;
          return (
            <Pressable
              key={col}
              style={styles.colorHit}
              onPress={() => setForm((f) => ({ ...f, color: col }))}
              accessibilityRole="radio"
              accessibilityLabel={col}
              accessibilityState={{ selected: on }}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: col },
                  on && { borderColor: c.textPrimary },
                  on && styles.dotOn,
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <SheetButton
        label={saving ? t('categories.saving') : t('categories.save')}
        onPress={() => {
          if (form.name.trim()) onSave(form);
        }}
        disabled={saving || !form.name.trim()}
      />
    </PageSheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(4) },
  icons: { flexDirection: 'row', flexWrap: 'wrap' },
  icon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: 4, bottom: 4, left: 4, right: 4 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(4) },
  colorHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  dotOn: { transform: [{ scale: 1.12 }] },
});
