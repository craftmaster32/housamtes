import React from 'react';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';

interface DateInputProps {
  value: string; // YYYY-MM-DD or empty string
  onChange: (val: string) => void;
  style?: object;
}

export function DateInput({ value, onChange, style }: DateInputProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const locale = i18n.language === 'he' ? 'he-IL' : i18n.language === 'es' ? 'es-ES' : 'en-GB';
  const displayText = value
    ? new Date(value + 'T12:00:00').toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : t('common.pick_date');

  return (
    // Wrapper div handles all clicks and calls showPicker() on the hidden input.
    // This works because showPicker() called from a parent element's click handler
    // is a valid user gesture — unlike calling it from the input's own onClick,
    // which conflicts with the browser's native "click to edit text segment" behavior.
    <div
      onClick={() => inputRef.current?.showPicker?.()}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: c.surface,
        borderRadius: sizes.borderRadius,
        border: `1px solid ${c.border}`,
        padding: `${sizes.sm}px ${sizes.md}px`,
        cursor: 'pointer',
        userSelect: 'none',
        boxSizing: 'border-box',
        ...((style as React.CSSProperties) || {}),
      }}
    >
      <svg
        width={15}
        height={15}
        viewBox="0 0 24 24"
        fill="none"
        stroke={c.textSecondary}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x={3} y={4.5} width={18} height={17} rx={2.5} />
        <path d="M3 9h18M8 2.5v4M16 2.5v4" />
      </svg>
      <span
        style={{
          fontSize: `${sizes.fontSm}px`,
          color: value ? c.textPrimary : c.textSecondary,
          fontFamily: 'inherit',
        }}
      >
        {displayText}
      </span>
      {/* Real date input — invisible, covers the wrapper, used only for the picker popup */}
      <input
        ref={inputRef}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
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
        }}
      />
    </div>
  );
}
