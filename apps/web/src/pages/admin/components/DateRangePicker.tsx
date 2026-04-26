import { useTranslation } from 'react-i18next';

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onApply: () => void;
  onReset: () => void;
}

export function DateRangePicker({ from, to, onFromChange, onToChange, onApply, onReset }: DateRangePickerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-sm text-zinc-500">{t('admin.filters.from')}</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-zinc-500">{t('admin.filters.to')}</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      <button
        onClick={onApply}
        className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
      >
        {t('admin.filters.apply')}
      </button>
      <button
        onClick={onReset}
        className="rounded-lg border border-zinc-200 px-4 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        {t('admin.filters.reset')}
      </button>
    </div>
  );
}
