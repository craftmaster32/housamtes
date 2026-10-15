import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { View, Pressable, TextInput, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { type GroceryItem } from '@stores/groceryStore';
import { useLanguageStore } from '@stores/languageStore';
import { useThemedColors, darkColors } from '@constants/colors';
import { ItemAgeMeta } from '@components/grocery/ItemAgeMeta';
import { UserAvatar } from '@components/shared/UserAvatar';
import { useMemberName } from '@hooks/useMemberName';
import { formatItemAge } from '@utils/groceryAge';
import { detectCategory, toneColors } from '@utils/groceryCategory';
import { localizeQuantityForDisplay } from '@utils/groceryUnits';
import { makeStyles, SWIPE_DELETE_WIDTH } from './GroceryItemRow.styles';

export interface GroceryItemRowProps {
  item: GroceryItem;
  myId: string;
  /** Shared clock (ms) so every row's age label refreshes together. */
  now: number;
  isDuplicate?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onUpdate: (id: string, name: string, quantity: string) => Promise<void>;
  onLongPress: (item: GroceryItem) => void;
}

export const GroceryItemRow = memo(function GroceryItemRow({
  item,
  myId,
  now,
  isDuplicate = false,
  onToggle,
  onDelete,
  onIncrement,
  onDecrement,
  onUpdate,
  onLongPress,
}: GroceryItemRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const isDark = C.background === darkColors.background;
  const language = useLanguageStore((s) => s.language);
  const memberName = useMemberName();
  const s = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const isPlainInt = /^\d+$/.test(item.quantity.trim());
  const qtyNum = isPlainInt ? parseInt(item.quantity, 10) : NaN;
  const hasCount = isPlainInt && qtyNum > 1;
  const bought = item.boughtCount ?? 0;
  const canEdit = item.addedBy === myId;
  const category = detectCategory(item.name);
  const tone = toneColors(item.isPersonal ? 'violet' : category.tone, isDark);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(item.quantity);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleTap = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onToggle(item.id);
  }, [item.id, onToggle]);

  const swipeRef = useRef<Swipeable>(null);
  const handleDelete = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    swipeRef.current?.close();
    onDelete(item.id);
  }, [item.id, onDelete]);

  // Web fires a press as two events sometimes; this ref swallows the echo so
  // one tap on +/- counts once. 50ms is well under any real double-tap.
  const lastStepRef = useRef(0);

  const handleDecrement = useCallback((): void => {
    const nowMs = Date.now();
    if (nowMs - lastStepRef.current < 50 || bought === 0) return;
    lastStepRef.current = nowMs;
    Haptics.selectionAsync().catch(() => {});
    onDecrement(item.id);
  }, [bought, item.id, onDecrement]);

  const handleIncrement = useCallback((): void => {
    const nowMs = Date.now();
    if (nowMs - lastStepRef.current < 50 || bought >= qtyNum) return;
    lastStepRef.current = nowMs;
    Haptics.selectionAsync().catch(() => {});
    onIncrement(item.id);
  }, [bought, qtyNum, item.id, onIncrement]);

  const handleEditNameChange = useCallback((v: string): void => {
    setEditName(v);
    setSaveError(null);
  }, []);
  const handleEditQtyChange = useCallback((v: string): void => {
    setEditQty(v);
    setSaveError(null);
  }, []);

  const startEdit = useCallback((): void => {
    setEditName(item.name);
    setEditQty(item.quantity);
    setSaveError(null);
    setIsEditing(true);
  }, [item.name, item.quantity]);

  const cancelEdit = useCallback((): void => {
    setSaveError(null);
    setIsEditing(false);
  }, []);

  const handleLongPress = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onLongPress(item);
  }, [item, onLongPress]);

  const saveEdit = useCallback(async (): Promise<void> => {
    const trimmed = editName.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onUpdate(item.id, trimmed, editQty.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setIsEditing(false);
    } catch {
      setSaveError(t('grocery.could_not_save'));
    } finally {
      setIsSaving(false);
    }
  }, [editName, editQty, item.id, onUpdate, isSaving, t]);

  if (isEditing) {
    return (
      <View>
        <View style={[s.card, s.cardEditing]}>
          <TextInput
            value={editName}
            onChangeText={handleEditNameChange}
            style={s.editNameInput}
            autoFocus
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={saveEdit}
            placeholder={t('grocery.item_name_placeholder')}
            placeholderTextColor={C.textSecondary}
            accessibilityLabel={t('grocery.item_name_edit')}
            accessibilityHint={t('grocery.item_name_edit_hint')}
          />
          <TextInput
            value={editQty}
            onChangeText={handleEditQtyChange}
            style={s.editQtyInput}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={saveEdit}
            placeholder={t('grocery.qty_edit_placeholder')}
            placeholderTextColor={C.textSecondary}
            accessibilityLabel={t('grocery.qty_edit')}
            accessibilityHint={t('grocery.qty_edit_hint')}
          />
          <Pressable
            onPress={saveEdit}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.save_changes')}
          >
            <Ionicons name="checkmark" size={20} color={C.positive} />
          </Pressable>
          <Pressable
            onPress={cancelEdit}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.cancel_edit')}
          >
            <Ionicons name="close" size={20} color={C.textSecondary} />
          </Pressable>
        </View>
        {!!saveError && <Text style={s.inlineError}>{saveError}</Text>}
      </View>
    );
  }

  const showQtyPill = !hasCount && !!item.quantity && item.quantity !== '1';

  const row = (
    <Pressable
      style={[
        s.card,
        item.isChecked && s.cardDone,
        item.isPersonal && !item.isDraft && s.cardPersonal,
      ]}
      // Counted items are driven only by their +/- control, so the card itself
      // isn't a toggle — that also stops a +/- tap from bubbling into a toggle.
      onPress={hasCount ? undefined : handleTap}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.isChecked }}
      accessibilityLabel={[
        item.name,
        isDuplicate ? t('grocery.already_on_shared') : null,
        item.isPersonal
          ? formatItemAge(item.createdAt, t, now)
          : t('grocery.added_by_meta', {
              name: item.addedBy === myId ? t('common.you') : memberName(item.addedBy),
              time: formatItemAge(item.createdAt, t, now),
            }),
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={t('grocery.long_press_hint')}
    >
      <View style={s.topRow}>
        <View style={[s.tile, { backgroundColor: item.isChecked ? C.surfaceSecondary : tone.bg }]}>
          <Ionicons
            name={item.isPersonal ? 'lock-closed-outline' : category.icon}
            size={20}
            color={item.isChecked ? C.textTertiary : tone.fg}
          />
        </View>

        <View style={s.main}>
          <View style={s.nameRow}>
            <Text style={[s.name, item.isChecked && s.nameDone]} numberOfLines={2}>
              {item.name}
            </Text>
            {showQtyPill && (
              <View style={[s.qtyPill, { backgroundColor: tone.bg }]}>
                <Text style={[s.qtyPillText, { color: tone.fg }]}>
                  {localizeQuantityForDisplay(item.quantity, language === 'he')}
                </Text>
              </View>
            )}
          </View>
          <View style={s.metaRow}>
            {!item.isPersonal && <UserAvatar userId={item.addedBy} size={18} />}
            <ItemAgeMeta
              addedBy={item.addedBy}
              createdAt={item.createdAt}
              myId={myId}
              now={now}
              showName={!item.isPersonal}
              isChecked={item.isChecked}
            />
          </View>
        </View>

        <View style={s.extras}>
          {isDuplicate && (
            <View style={s.dupBadge} accessibilityLabel={t('grocery.already_on_shared')}>
              <Text style={s.dupBadgeText}>{t('grocery.on_list')}</Text>
            </View>
          )}
          {!!item.comment && (
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={15}
              color={C.textSecondary}
              accessibilityLabel={t('grocery.has_note')}
            />
          )}
          {canEdit && !item.isChecked && (
            <Pressable
              onPress={startEdit}
              style={s.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('grocery.edit_item', { name: item.name })}
            >
              <Ionicons name="pencil-outline" size={16} color={C.textSecondary} />
            </Pressable>
          )}
        </View>

        {hasCount ? (
          <View style={s.counter}>
            <Pressable
              onPress={handleDecrement}
              style={[s.ctrBtn, bought === 0 && s.ctrBtnOff]}
              accessibilityRole="button"
              accessibilityLabel={t('grocery.decrease_item', { name: item.name })}
              accessibilityState={{ disabled: bought === 0 }}
            >
              <Text style={s.ctrBtnText}>−</Text>
            </Pressable>
            <Text style={s.ctrText}>
              {bought}/{qtyNum}
            </Text>
            <Pressable
              onPress={handleIncrement}
              style={[s.ctrBtn, s.ctrBtnPlus, bought >= qtyNum && s.ctrBtnOff]}
              accessibilityRole="button"
              accessibilityLabel={t('grocery.increase_item', { name: item.name })}
              accessibilityState={{ disabled: bought >= qtyNum }}
            >
              <Text style={[s.ctrBtnText, s.ctrBtnTextPlus]}>+</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[s.check, item.isChecked && s.checkOn]} accessibilityElementsHidden>
            {item.isChecked && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
          </View>
        )}
      </View>

      {hasCount && (
        <View style={s.progressWrap}>
          <View style={s.progressTrack}>
            <View
              style={[
                s.progressFill,
                { width: `${Math.round((bought / qtyNum) * 100)}%` as `${number}%` },
              ]}
            />
          </View>
          <Text style={s.progressLabel}>
            {bought >= qtyNum
              ? t('grocery.all_bought')
              : t('grocery.n_left', { count: qtyNum - bought })}
          </Text>
        </View>
      )}
    </Pressable>
  );

  // Swipe left-to-reveal a red Delete, like a native list. Any housemate can
  // remove a shared item (the screen confirms first when it isn't yours), so
  // stale items don't get stuck on the list.
  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={(_progress, dragX) => {
        // Slide the panel in 1:1 with the drag so it stays glued to the card's
        // right edge instead of sitting revealed underneath as a floating box.
        const translateX = dragX.interpolate({
          inputRange: [-SWIPE_DELETE_WIDTH, 0],
          outputRange: [0, SWIPE_DELETE_WIDTH],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View style={[s.swipeLane, { transform: [{ translateX }] }]}>
            <Pressable
              style={s.swipeDelete}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={t('grocery.delete_item_name', { name: item.name })}
            >
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              <Text style={s.swipeDeleteText}>{t('common.delete')}</Text>
            </Pressable>
          </Animated.View>
        );
      }}
      overshootRight={false}
      rightThreshold={40}
      friction={2}
    >
      {row}
    </Swipeable>
  );
});
