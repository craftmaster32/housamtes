import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput, Alert, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@stores/authStore';
import { useExpenseCategoriesStore, PRESET_COLORS, type ExpenseCategory } from '@stores/expenseCategoriesStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

const makeStyles = (C: ColorTokens) => StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    list: { padding: sizes.lg, paddingBottom: 60, gap: 0 },

    screenTitle: { fontSize: 24, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
    screenSub:   { fontSize: 14, ...font.regular, color: C.textSecondary, lineHeight: 20, marginBottom: sizes.lg },

    addBtn:     { backgroundColor: C.primary, borderRadius: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center', marginBottom: sizes.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
    addBtnText: { color: '#FFF', ...font.semibold, fontSize: 15 },

    listHeader: { fontSize: 11, ...font.bold, color: C.textSecondary, letterSpacing: 1.2, marginBottom: sizes.sm },

    formCard: {
      backgroundColor: C.surface, borderRadius: sizes.borderRadiusLg,
      padding: sizes.md, gap: sizes.md, marginBottom: sizes.lg,
      borderWidth: 1, borderColor: C.primary + '40',
    },
    formRow:   { flexDirection: 'row', gap: 8 },
    iconInput: {
      width: 52, height: 46, borderRadius: 10, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.surfaceSecondary, textAlign: 'center', fontSize: 22,
    },
    nameInput: {
      flex: 1, height: 46, borderRadius: 10, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.surfaceSecondary, paddingHorizontal: 12,
      fontSize: 15, ...font.regular, color: C.textPrimary,
    },
    colorRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    colorDot:        { width: 28, height: 28, borderRadius: 14 },
    colorDotSelected:{ borderWidth: 3, borderColor: C.textPrimary },
    formBtns:        { flexDirection: 'row', gap: 10, alignItems: 'center' },
    btnSave:         { backgroundColor: C.primary, paddingHorizontal: sizes.lg, paddingVertical: 10, borderRadius: 10 },
    btnSaveOff:      { opacity: 0.5 },
    btnSaveText:     { color: '#FFF', ...font.semibold, fontSize: 14 },
    btnCancel:       { paddingHorizontal: 8, paddingVertical: 10 },
    btnCancelText:   { color: C.textSecondary, fontSize: 14, ...font.regular },

    catRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, padding: sizes.md, gap: 10 },
    catIconWrap:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    catIcon:    { fontSize: 18 },
    catInfo:    { flex: 1 },
    catName:    { fontSize: 15, ...font.semibold, color: C.textPrimary },
    catDefault: { fontSize: 12, ...font.regular, color: C.textSecondary },
    colorSwatch:{ width: 12, height: 12, borderRadius: 6 },
    rowBtn:     { paddingHorizontal: 6 },
    rowBtnEdit: { fontSize: 13, ...font.semibold, color: C.primary },
    rowBtnDelete:{ fontSize: 13, ...font.semibold, color: C.negative },

    sep:   { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: sizes.md + 36 + 10 },
    empty: { textAlign: 'center', color: C.textSecondary, fontSize: 14, paddingVertical: 24 },
});

// ── Add / Edit form ────────────────────────────────────────────────────────────
interface FormState { name: string; icon: string; color: string }

function CategoryForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [form, setForm] = useState<FormState>(initial);

  return (
    <View style={styles.formCard}>
      <View style={styles.formRow}>
        <TextInput
          value={form.icon}
          onChangeText={(v) => setForm((f) => ({ ...f, icon: v }))}
          style={styles.iconInput}
          maxLength={2}
          placeholder="🏷️"
          placeholderTextColor={C.textSecondary}
        />
        <TextInput
          value={form.name}
          onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
          style={styles.nameInput}
          placeholder="Category name"
          placeholderTextColor={C.textSecondary}
          autoCapitalize="words"
          maxLength={30}
        />
      </View>
      <View style={styles.colorRow}>
        {PRESET_COLORS.map((c) => (
          <Pressable
            key={c}
            style={[styles.colorDot, { backgroundColor: c }, form.color === c && styles.colorDotSelected]}
            onPress={() => setForm((f) => ({ ...f, color: c }))}
          />
        ))}
      </View>
      <View style={styles.formBtns}>
        <Pressable
          style={[styles.btnSave, saving && styles.btnSaveOff]}
          onPress={() => { if (form.name.trim()) onSave(form); }}
          disabled={saving || !form.name.trim()}
          accessibilityRole="button"
        >
          <Text style={styles.btnSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={styles.btnCancel} accessibilityRole="button">
          <Text style={styles.btnCancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Category row ──────────────────────────────────────────────────────────────
function CategoryRow({
  cat,
  onEdit,
  onDelete,
}: {
  cat: ExpenseCategory;
  onEdit: (cat: ExpenseCategory) => void;
  onDelete: (cat: ExpenseCategory) => void;
}): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={styles.catRow}>
      <View style={[styles.catIconWrap, { backgroundColor: cat.color + '20' }]}>
        <Text style={styles.catIcon}>{cat.icon}</Text>
      </View>
      <View style={styles.catInfo}>
        <Text style={styles.catName}>{cat.name}</Text>
        {cat.isDefault && <Text style={styles.catDefault}>Default</Text>}
      </View>
      <View style={[styles.colorSwatch, { backgroundColor: cat.color }]} />
      {!cat.isDefault && (
        <>
          <Pressable onPress={() => onEdit(cat)} style={styles.rowBtn} hitSlop={8} accessibilityRole="button">
            <Text style={styles.rowBtnEdit}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(cat)} style={styles.rowBtn} hitSlop={8} accessibilityRole="button">
            <Text style={styles.rowBtnDelete}>Delete</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CategoriesScreen(): React.JSX.Element {
  const houseId    = useAuthStore((s) => s.houseId);
  const categories = useExpenseCategoriesStore((s) => s.categories);
  const isLoading  = useExpenseCategoriesStore((s) => s.isLoading);
  const load       = useExpenseCategoriesStore((s) => s.load);
  const add        = useExpenseCategoriesStore((s) => s.add);
  const update     = useExpenseCategoriesStore((s) => s.update);
  const remove     = useExpenseCategoriesStore((s) => s.remove);

  const [showAdd, setShowAdd]     = useState(false);
  const [editCat, setEditCat]     = useState<ExpenseCategory | null>(null);
  const [saving, setSaving]       = useState(false);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (houseId) load(houseId);
  }, [houseId, load]);

  const handleAdd = useCallback(async (form: { name: string; icon: string; color: string }) => {
    if (!houseId) return;
    setSaving(true);
    try {
      await add({ name: form.name.trim(), icon: form.icon || '📦', color: form.color }, houseId);
      setShowAdd(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [houseId, add]);

  const handleUpdate = useCallback(async (form: { name: string; icon: string; color: string }) => {
    if (!editCat) return;
    setSaving(true);
    try {
      await update(editCat.id, { name: form.name.trim(), icon: form.icon || editCat.icon, color: form.color });
      setEditCat(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [editCat, update]);

  const handleDelete = useCallback((cat: ExpenseCategory) => {
    Alert.alert('Delete Category', `Remove "${cat.name}"? Bills with this category will keep the name but it won't appear as an option.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async (): Promise<void> => {
        await remove(cat.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }},
    ]);
  }, [remove]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <FlatList
          data={categories}
          keyExtractor={(c) => c.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <Text style={styles.screenTitle}>Expense Categories</Text>
              <Text style={styles.screenSub}>
                These categories appear when adding bills. They also group your spending on the profile page.
              </Text>

              {showAdd && (
                <CategoryForm
                  initial={{ name: '', icon: '📦', color: PRESET_COLORS[0] }}
                  onSave={handleAdd}
                  onCancel={() => setShowAdd(false)}
                  saving={saving}
                />
              )}

              {editCat && (
                <CategoryForm
                  initial={{ name: editCat.name, icon: editCat.icon, color: editCat.color }}
                  onSave={handleUpdate}
                  onCancel={() => setEditCat(null)}
                  saving={saving}
                />
              )}

              {!showAdd && !editCat && (
                <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)} accessibilityRole="button">
                  <Text style={styles.addBtnText}>+ Add Category</Text>
                </Pressable>
              )}

              <Text style={styles.listHeader}>ALL CATEGORIES</Text>
            </View>
          }
          renderItem={({ item }) => (
            <CategoryRow cat={item} onEdit={setEditCat} onDelete={handleDelete} />
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            isLoading ? <Text style={styles.empty}>Loading…</Text> : null
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}
