import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Sentry from '@sentry/react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import {
  useExpenseCategoriesStore,
  PRESET_COLORS,
  DEFAULT_CATEGORY_ICON,
  DUPLICATE_CATEGORY,
  type ExpenseCategory,
} from '@stores/expenseCategoriesStore';
import type { TFunction } from 'i18next';
import { Alert } from '@lib/alert';
import { localizeCategoryName } from '@utils/categoryName';
import { asWord } from '@utils/asWord';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { BackLink } from '@components/shared/BackLink';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { CategorySheet } from '@components/settings/CategorySheet';
import { CategoryRow } from '@components/settings/CategoryRow';

import { mf, ms } from '@utils/responsive';
// Builds the alert message for a failed category save. A duplicate name gets a
// clear translated message; create vs update failures use distinct keys.
function categorySaveMessage(
  err: unknown,
  name: string,
  operation: 'add' | 'update',
  t: TFunction
): string {
  const reason = err instanceof Error ? err.message : '';
  if (reason === DUPLICATE_CATEGORY) return t('categories.already_exists', { name });
  return operation === 'update' ? t('categories.could_not_update') : t('categories.could_not_save');
}

export default function CategoriesScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const houseId = useAuthStore((s) => s.houseId);
  const userId = useAuthStore((s) => s.user?.id);
  const categories = useExpenseCategoriesStore((s) => s.categories);
  const isLoading = useExpenseCategoriesStore((s) => s.isLoading);
  const load = useExpenseCategoriesStore((s) => s.load);
  const add = useExpenseCategoriesStore((s) => s.add);
  const update = useExpenseCategoriesStore((s) => s.update);
  const remove = useExpenseCategoriesStore((s) => s.remove);

  const [showAdd, setShowAdd] = useState(false);
  const [editCat, setEditCat] = useState<ExpenseCategory | null>(null);
  const [saving, setSaving] = useState(false);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('semibold');

  useEffect(() => {
    if (houseId) load(houseId);
  }, [houseId, load]);

  const handleAdd = useCallback(
    async (form: { name: string; icon: string; color: string }) => {
      if (!houseId) return;
      setSaving(true);
      try {
        await add(
          { name: form.name.trim(), icon: form.icon || DEFAULT_CATEGORY_ICON, color: form.color },
          houseId
        );
        setShowAdd(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (err) {
        Sentry.captureException(err, { extra: { houseId, userId } });
        Alert.alert(t('common.error'), categorySaveMessage(err, form.name.trim(), 'add', t));
      } finally {
        setSaving(false);
      }
    },
    [houseId, userId, add, t]
  );

  const handleUpdate = useCallback(
    async (form: { name: string; icon: string; color: string }) => {
      if (!editCat) return;
      setSaving(true);
      try {
        await update(editCat.id, {
          name: form.name.trim(),
          icon: form.icon || editCat.icon,
          color: form.color,
        });
        setEditCat(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (err) {
        Sentry.captureException(err, { extra: { houseId, userId, categoryId: editCat.id } });
        Alert.alert(t('common.error'), categorySaveMessage(err, form.name.trim(), 'update', t));
      } finally {
        setSaving(false);
      }
    },
    [houseId, userId, editCat, update, t]
  );

  const handleDelete = useCallback(
    (cat: ExpenseCategory) => {
      Alert.alert(
        t('categories.delete_title'),
        t('categories.delete_confirm', { name: localizeCategoryName(cat.name, t) }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async (): Promise<void> => {
              try {
                await remove(cat.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              } catch (err) {
                Sentry.captureException(err, { extra: { houseId, userId, categoryId: cat.id } });
                Alert.alert(t('common.error'), t('categories.could_not_delete'));
              }
            },
          },
        ]
      );
    },
    [houseId, userId, remove, t]
  );

  const sheetOpen = showAdd || !!editCat;
  const closeSheet = useCallback((): void => {
    setShowAdd(false);
    setEditCat(null);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        <BackLink label={t('nav.settings')} />
        <Text style={[styles.title, headingFont]}>{t('categories.title')}</Text>
        <Text style={styles.sub}>{t('categories.subtitle')}</Text>
        <View style={styles.tagRow}>
          <PaperTag
            label={t('categories.add_category').replace(/^\+\s*/, '')}
            onPress={() => setShowAdd(true)}
          />
        </View>

        <Text style={[styles.section, headingFont]}>{asWord(t('categories.all_categories'))}</Text>
        {categories.length === 0 ? (
          <Text style={styles.empty}>
            {isLoading ? t('common.loading') : t('categories.no_categories')}
          </Text>
        ) : (
          <View style={styles.card}>
            {categories.map((item, i) => (
              <CategoryRow
                key={item.id}
                cat={item}
                last={i === categories.length - 1}
                onEdit={setEditCat}
                onDelete={handleDelete}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <CategorySheet
        visible={sheetOpen}
        editing={!!editCat}
        initial={
          editCat
            ? { name: editCat.name, icon: editCat.icon, color: editCat.color }
            : { name: '', icon: DEFAULT_CATEGORY_ICON, color: PRESET_COLORS[0] }
        }
        saving={saving}
        onSave={editCat ? handleUpdate : handleAdd}
        onClose={closeSheet}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    list: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(60) },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    sub: { fontSize: mf(14), lineHeight: mf(20), ...font.regular, color: C.textSecondary },
    tagRow: { flexDirection: 'row', marginTop: ms(14) },
    section: {
      fontSize: mf(22),
      lineHeight: mf(29),
      marginTop: ms(26),
      marginBottom: ms(10),
      color: C.textPrimary,
    },
    card: {
      backgroundColor: C.surface,
      borderRadius: ms(22),
      paddingHorizontal: ms(18),
      paddingVertical: ms(2),
    },
    empty: { fontSize: mf(14), ...font.regular, color: C.textSecondary, paddingVertical: ms(20) },
  });
