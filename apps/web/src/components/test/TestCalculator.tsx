import { useCallback, useReducer } from 'react';
import { useTranslation } from 'react-i18next';

type Op = '+' | '-' | '*' | '/';

interface CalcState {
  display: string;
  stored: number | null;
  pendingOp: Op | null;
  fresh: boolean;
}

type CalcAction =
  | { type: 'digit'; d: string }
  | { type: 'dot' }
  | { type: 'op'; op: Op }
  | { type: 'eq' }
  | { type: 'clear' }
  | { type: 'back' };

const initialState: CalcState = {
  display: '0',
  stored: null,
  pendingOp: null,
  fresh: true,
};

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? NaN : a / b;
  }
}

function formatDisplay(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  const rounded = Number(n.toPrecision(12));
  if (!Number.isFinite(rounded)) return 'Error';
  let s = String(rounded);
  if (s === '-0') s = '0';
  return s;
}

function calcReducer(state: CalcState, action: CalcAction): CalcState {
  if (state.display === 'Error' && action.type !== 'clear' && action.type !== 'back') {
    if (action.type === 'digit') {
      return { ...initialState, display: action.d, fresh: false };
    }
    return state;
  }

  switch (action.type) {
    case 'digit': {
      const { d } = action;
      if (state.fresh) {
        return { ...state, display: d === '.' ? '0.' : d, fresh: false };
      }
      if (d === '0' && state.display === '0') return state;
      if (state.display === '0' && d !== '.') return { ...state, display: d };
      if (state.display.replace('-', '').length >= 14) return state;
      return { ...state, display: state.display + d };
    }
    case 'dot': {
      if (state.fresh) return { ...state, display: '0.', fresh: false };
      if (state.display.includes('.')) return state;
      return { ...state, display: `${state.display}.` };
    }
    case 'op': {
      const cur = parseFloat(state.display);
      if (!Number.isFinite(cur)) return { ...state, display: 'Error', stored: null, pendingOp: null, fresh: true };

      if (state.pendingOp !== null && state.stored !== null && !state.fresh) {
        const res = compute(state.stored, cur, state.pendingOp);
        if (!Number.isFinite(res)) {
          return { display: 'Error', stored: null, pendingOp: null, fresh: true };
        }
        return {
          display: formatDisplay(res),
          stored: res,
          pendingOp: action.op,
          fresh: true,
        };
      }

      return {
        ...state,
        stored: cur,
        pendingOp: action.op,
        fresh: true,
      };
    }
    case 'eq': {
      if (state.pendingOp === null || state.stored === null) {
        return { ...state, fresh: true };
      }
      const cur = parseFloat(state.display);
      if (!Number.isFinite(cur)) return { ...state, display: 'Error', stored: null, pendingOp: null, fresh: true };
      const res = compute(state.stored, cur, state.pendingOp);
      if (!Number.isFinite(res)) {
        return { display: 'Error', stored: null, pendingOp: null, fresh: true };
      }
      return {
        display: formatDisplay(res),
        stored: null,
        pendingOp: null,
        fresh: true,
      };
    }
    case 'clear':
      return initialState;
    case 'back': {
      if (state.fresh) return state;
      if (state.display.length <= 1) return { ...state, display: '0', fresh: true };
      const next = state.display.slice(0, -1);
      return { ...state, display: next === '-' ? '0' : next };
    }
    default:
      return state;
  }
}

interface Props {
  onClose: () => void;
}

export function TestCalculator({ onClose }: Props) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(calcReducer, initialState);

  const pad = useCallback(
    (label: string, action: CalcAction, className = '', ariaLabel?: string) => (
      <button
        type="button"
        className={`test-calculator-key ${className}`.trim()}
        onClick={() => dispatch(action)}
        aria-label={ariaLabel}
      >
        {label}
      </button>
    ),
    [],
  );

  return (
    <>
      <button
        type="button"
        className="test-calculator-backdrop"
        aria-label={t('test.calculatorClose')}
        onClick={onClose}
      />
      <div
        className="test-calculator-panel surface"
        role="dialog"
        aria-modal="true"
        aria-label={t('test.calculatorAria')}
      >
        <div className="test-calculator-head">
          <span className="test-calculator-title">{t('test.calculator')}</span>
          <button type="button" className="test-calculator-close" onClick={onClose} aria-label={t('test.calculatorClose')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="test-calculator-display" aria-live="polite">
          {state.display}
        </div>
        <div className="test-calculator-grid">
          {pad('AC', { type: 'clear' }, 'test-calculator-key--muted', t('test.calculatorClear'))}
          {pad('⌫', { type: 'back' }, 'test-calculator-key--muted', t('test.calculatorBackspace'))}
          {pad('÷', { type: 'op', op: '/' }, 'test-calculator-key--op')}
          {pad('×', { type: 'op', op: '*' }, 'test-calculator-key--op')}

          {pad('7', { type: 'digit', d: '7' })}
          {pad('8', { type: 'digit', d: '8' })}
          {pad('9', { type: 'digit', d: '9' })}
          {pad('−', { type: 'op', op: '-' }, 'test-calculator-key--op')}

          {pad('4', { type: 'digit', d: '4' })}
          {pad('5', { type: 'digit', d: '5' })}
          {pad('6', { type: 'digit', d: '6' })}
          {pad('+', { type: 'op', op: '+' }, 'test-calculator-key--op')}

          {pad('1', { type: 'digit', d: '1' })}
          {pad('2', { type: 'digit', d: '2' })}
          {pad('3', { type: 'digit', d: '3' })}
          {pad('=', { type: 'eq' }, 'test-calculator-key--eq')}

          {pad('0', { type: 'digit', d: '0' }, 'test-calculator-key--zero')}
          {pad('.', { type: 'dot' })}
        </div>
      </div>
    </>
  );
}
