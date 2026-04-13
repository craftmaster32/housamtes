import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';

// ─── constants ───────────────────────────────────────────────────────────────
const ITEM_H = 48;
const VISIBLE = 5;
const WHEEL_H = ITEM_H * VISIBLE;           // 240
const PAD = ITEM_H * Math.floor(VISIBLE / 2); // 96

const HOURS_LIST = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_LIST = Array.from({ length: 12 }, (_, i) => i * 5);

// ─── helpers ─────────────────────────────────────────────────────────────────
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseRaw(raw: string): string | null {
  const cleaned = raw.trim().replace(/[^0-9:]/g, '');
  let h: number;
  let m: number;
  if (cleaned.includes(':')) {
    const [hp, mp] = cleaned.split(':');
    h = parseInt(hp, 10);
    m = parseInt(mp ?? '0', 10);
  } else if (cleaned.length >= 3) {
    const pivot = cleaned.length === 3 ? 1 : 2;
    h = parseInt(cleaned.slice(0, pivot), 10);
    m = parseInt(cleaned.slice(pivot), 10);
  } else {
    return null;
  }
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

function closestMinuteIndex(m: number): number {
  let best = 0;
  let bestDiff = 60;
  MINUTES_LIST.forEach((v, i) => {
    const diff = Math.abs(v - m);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  return best;
}

// ─── WheelColumn ─────────────────────────────────────────────────────────────
interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  colWidth: number;
}

function WheelColumn({ items, selectedIndex, onSelect, colWidth }: WheelColumnProps): React.JSX.Element {
  const scrollRef   = useRef<ScrollView>(null);
  const hasMounted  = useRef(false);
  const lastEmitted = useRef(selectedIndex);       // last index we sent up via onSelect
  const liveY       = useRef(selectedIndex * ITEM_H); // real-time scroll position
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSettling  = useRef(false);               // true while we're programmatically scrolling

  // snap + commit at a given index — used after debounce and on press
  const selectItem = useCallback((index: number): void => {
    const clipped = Math.max(0, Math.min(index, items.length - 1));
    const y = clipped * ITEM_H;

    isSettling.current = true;
    scrollRef.current?.scrollTo({ y, animated: true });
    liveY.current = y;

    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => { isSettling.current = false; }, 450);

    if (clipped !== lastEmitted.current) {
      lastEmitted.current = clipped;
      onSelect(clipped);
    }
  }, [items.length, onSelect]);

  // when parent changes selectedIndex externally (e.g. text entry)
  useEffect(() => {
    const y = selectedIndex * ITEM_H;
    if (!hasMounted.current) {
      hasMounted.current = true;
      // initial position — non-animated, no events fired
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ y, animated: false });
        liveY.current = y;
      }, 40);
      return () => clearTimeout(t);
    }
    // only scroll when it was changed from outside, not from our own onSelect
    if (selectedIndex !== lastEmitted.current) {
      isSettling.current = true;
      scrollRef.current?.scrollTo({ y, animated: true });
      liveY.current = y;
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => { isSettling.current = false; }, 450);
      lastEmitted.current = selectedIndex;
    }
    return undefined;
  }, [selectedIndex]);

  // debounced scroll handler — fires on every frame while scrolling
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (isSettling.current) return; // ignore our own programmatic scrolls

    liveY.current = e.nativeEvent.contentOffset.y;

    // reset debounce: commit 100 ms after the last scroll event
    if (commitTimer.current !== null) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null;
      const index = Math.max(0, Math.min(Math.round(liveY.current / ITEM_H), items.length - 1));
      selectItem(index);
    }, 100);
  }, [items.length, selectItem]);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ height: WHEEL_H, width: colWidth }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}          // native snap as first-line assist
      decelerationRate="fast"
      onScroll={handleScroll}
      scrollEventThrottle={16}         // ~60 fps updates
      contentContainerStyle={{ paddingVertical: PAD }}
    >
      {items.map((label, index) => {
        const dist = Math.abs(index - selectedIndex);
        return (
          <Pressable
            key={label}
            style={[colStyles.item, { width: colWidth }]}
            onPress={() => selectItem(index)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: dist === 0 }}
          >
            <Text style={[
              colStyles.label,
              dist === 0 && colStyles.labelSelected,
              dist === 1 && colStyles.labelNear,
              dist >= 2  && colStyles.labelFar,
            ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const colStyles = StyleSheet.create({
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  label:         { fontSize: 22, ...font.semibold, color: colors.textPrimary },
  labelSelected: { fontSize: 28, ...font.bold,     color: colors.textPrimary },
  labelNear:     { fontSize: 20, ...font.medium,   color: colors.textSecondary, opacity: 0.55 },
  labelFar:      { fontSize: 17, ...font.regular,  color: colors.textSecondary, opacity: 0.22 },
});

// ─── TimePicker ──────────────────────────────────────────────────────────────
interface TimePickerProps {
  value: string; // 'HH:MM' or ''
  onChange: (t: string) => void;
}

export function TimePicker({ value, onChange }: TimePickerProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [rawInput, setRawInput]   = useState('');
  const inputRef = useRef<TextInput>(null);

  const hourIndex = value ? parseInt(value.split(':')[0], 10) : 9;
  const minIndex  = value ? closestMinuteIndex(parseInt(value.split(':')[1], 10)) : 0;

  const handleHourSelect = useCallback((index: number): void => {
    const h = HOURS_LIST[index];
    const m = value
      ? MINUTES_LIST[closestMinuteIndex(parseInt(value.split(':')[1], 10))]
      : 0;
    onChange(`${pad(h)}:${pad(m)}`);
  }, [value, onChange]);

  const handleMinuteSelect = useCallback((index: number): void => {
    const m = MINUTES_LIST[index];
    const h = value ? parseInt(value.split(':')[0], 10) : 9;
    onChange(`${pad(h)}:${pad(m)}`);
  }, [value, onChange]);

  const startEditing = (): void => {
    setRawInput(value);
    setIsEditing(true);
  };

  const commitEdit = (): void => {
    if (rawInput.trim() === '') {
      onChange('');
    } else {
      const parsed = parseRaw(rawInput);
      if (parsed) onChange(parsed);
    }
    setIsEditing(false);
    Keyboard.dismiss();
  };

  // ── empty state ────────────────────────────────────────────────────────────
  if (!value && !isEditing) {
    return (
      <Pressable
        style={pickerStyles.addBtn}
        onPress={() => onChange('09:00')}
        accessibilityRole="button"
        accessibilityLabel="Add a time"
      >
        <Ionicons name="add-circle-outline" size={17} color={colors.primary} />
        <Text style={pickerStyles.addBtnText}>Add time</Text>
      </Pressable>
    );
  }

  // ── manual text entry ──────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <View style={pickerStyles.editRow}>
        <TextInput
          ref={inputRef}
          style={pickerStyles.textInput}
          value={rawInput}
          onChangeText={setRawInput}
          onBlur={commitEdit}
          onSubmitEditing={commitEdit}
          placeholder="HH:MM"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          accessibilityLabel="Enter time manually"
          accessibilityHint="Type a time in HH:MM format"
        />
        <Pressable
          style={pickerStyles.cancelBtn}
          onPress={() => setIsEditing(false)}
          accessibilityRole="button"
        >
          <Text style={pickerStyles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ── wheel picker ───────────────────────────────────────────────────────────
  return (
    <View style={pickerStyles.wrap}>
      <View style={pickerStyles.pickerRow}>
        <View style={pickerStyles.wheelsWrap}>
          {/* Selection highlight band */}
          <View style={pickerStyles.highlight} pointerEvents="none" />

          <View style={pickerStyles.columnsRow}>
            <WheelColumn
              items={HOURS_LIST.map(pad)}
              selectedIndex={hourIndex}
              onSelect={handleHourSelect}
              colWidth={76}
            />
            <Text style={pickerStyles.colon}>:</Text>
            <WheelColumn
              items={MINUTES_LIST.map(pad)}
              selectedIndex={minIndex}
              onSelect={handleMinuteSelect}
              colWidth={76}
            />
          </View>
        </View>

        {/* Pencil — tap to type manually */}
        <Pressable
          style={pickerStyles.editBtn}
          onPress={startEditing}
          accessibilityRole="button"
          accessibilityLabel="Type time manually"
        >
          <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Pressable
        style={pickerStyles.clearBtn}
        onPress={() => onChange('')}
        accessibilityRole="button"
        accessibilityLabel="Clear time"
      >
        <Text style={pickerStyles.clearText}>Clear time</Text>
      </Pressable>
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1,
    borderColor: colors.primary, backgroundColor: colors.secondary,
  },
  addBtnText: { fontSize: 14, ...font.medium, color: colors.primary },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textInput: {
    flex: 1, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14, backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.primary,
    fontSize: 26, ...font.semibold, color: colors.textPrimary,
    letterSpacing: 3, textAlign: 'center',
  },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  cancelText: { fontSize: 14, ...font.medium, color: colors.textSecondary },

  wrap: { gap: 8 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wheelsWrap: { position: 'relative' },
  highlight: {
    position: 'absolute',
    left: 0, right: 0,
    top: PAD, height: ITEM_H,
    backgroundColor: colors.textPrimary,
    borderRadius: 14, opacity: 0.07,
  },
  columnsRow: { flexDirection: 'row', alignItems: 'center' },
  colon: {
    fontSize: 30, ...font.bold, color: colors.textPrimary, marginHorizontal: 4,
  },
  editBtn: {
    padding: 10, borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
  },

  clearBtn: { alignSelf: 'flex-start' },
  clearText: { fontSize: 12, ...font.regular, color: colors.textSecondary, textDecorationLine: 'underline' },
});
