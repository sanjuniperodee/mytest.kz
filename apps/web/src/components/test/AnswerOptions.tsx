import { useMemo } from 'react';
import { renderMathInText } from '../../lib/katex';
import type { AnswerOption } from '../../api/types';

interface Props {
  options: AnswerOption[];
  selectedIds: string[];
  isMultiple: boolean;
  disabled?: boolean;
  showCorrect?: boolean;
  onSelect: (optionId: string) => void;
}

export function AnswerOptions({ options, selectedIds, isMultiple, disabled = false, showCorrect = false, onSelect }: Props) {
  return (
    <div className="answer-options" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map((option, index) => (
        <OptionItem
          key={option.id}
          option={option}
          index={index}
          isSelected={selectedIds.includes(option.id)}
          isMultiple={isMultiple}
          disabled={disabled}
          showCorrect={showCorrect}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function OptionItem({ option, index, isSelected, isMultiple, disabled, showCorrect, onSelect }: {
  option: AnswerOption; index: number; isSelected: boolean; isMultiple: boolean;
  disabled: boolean; showCorrect: boolean; onSelect: (id: string) => void;
}) {
  const renderedContent = useMemo(() => renderMathInText(option.content), [option.content]);
  const letter = 'ABCDEFGH'[index] || String(index + 1);

  let bg = 'var(--bg-card)';
  let border = 'var(--border)';
  let indicatorBg = 'transparent';
  let indicatorBorder = 'var(--text-muted)';
  let indicatorColor = 'var(--text-primary)';
  let shadow = 'var(--shadow-sm)';

  if (showCorrect && option.isCorrect) {
    bg = 'var(--success-surface)';
    border = 'rgba(16, 185, 129, 0.3)';
    indicatorBg = 'var(--success)';
    indicatorBorder = 'var(--success)';
    indicatorColor = '#fff';
    shadow = '0 0 0 1px rgba(16, 185, 129, 0.2)';
  } else if (showCorrect && isSelected && !option.isCorrect) {
    bg = 'var(--error-surface)';
    border = 'rgba(239, 68, 68, 0.3)';
    indicatorBg = 'var(--error)';
    indicatorBorder = 'var(--error)';
    indicatorColor = '#fff';
    shadow = '0 0 0 1px rgba(239, 68, 68, 0.2)';
  } else if (isSelected) {
    bg = 'var(--accent-surface)';
    border = 'var(--border-active)';
    indicatorBg = 'var(--accent)';
    indicatorBorder = 'var(--accent)';
    indicatorColor = '#fff';
    shadow = '0 0 0 1px var(--border-active), 0 2px 8px var(--accent-glow)';
  }

  return (
    <button
      onClick={() => !disabled && onSelect(option.id)}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--r-md)',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 150ms var(--ease)',
        width: '100%',
        boxShadow: shadow,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{
        width: 30,
        height: 30,
        borderRadius: isMultiple ? 'var(--r-xs)' : '50%',
        border: `2px solid ${indicatorBorder}`,
        background: indicatorBg,
        color: indicatorColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
        transition: 'all 200ms var(--ease)',
      }}>
        {showCorrect && option.isCorrect ? '✓' : showCorrect && isSelected && !option.isCorrect ? '✗' : letter}
      </span>
      <span
        dangerouslySetInnerHTML={{ __html: renderedContent }}
        style={{ flex: 1, fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', paddingTop: 4 }}
      />
    </button>
  );
}
