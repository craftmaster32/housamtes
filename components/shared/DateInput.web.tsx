import React from 'react';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';

interface DateInputProps {
  value: string; // YYYY-MM-DD or empty string
  onChange: (val: string) => void;
  style?: object;
}

// Extend HTMLInputElement to include the showPicker API (not yet in TS DOM lib)
interface DateInputElement extends HTMLInputElement {
  showPicker?: () => void;
}

export function DateInput({ value, onChange, style }: DateInputProps): React.JSX.Element {
  const inputRef = React.useRef<DateInputElement>(null);

  const [yr, mo, dy] = value ? value.split('-') : ['', '', ''];
  const displayText = value ? `${dy}/${mo}/${yr}` : 'Select date';

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
        backgroundColor: colors.white,
        borderRadius: sizes.borderRadius,
        border: `1px solid ${colors.border}`,
        padding: `${sizes.sm}px ${sizes.md}px`,
        cursor: 'pointer',
        userSelect: 'none',
        boxSizing: 'border-box',
        ...((style as React.CSSProperties) || {}),
      }}
    >
      <span style={{ fontSize: '14px', lineHeight: '1' }}>📅</span>
      <span
        style={{
          fontSize: `${sizes.fontSm}px`,
          color: value ? colors.textPrimary : colors.textSecondary,
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
