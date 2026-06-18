import type { ReactNode } from 'react';

/**
 * Единый hero-заголовок страницы (eyebrow + заголовок + лид + опциональный
 * aside). Использует тот же визуальный язык, что и дашборд (`pg-dash__hero`),
 * чтобы все разделы выглядели одинаково. Глобальная шапка оболочки при этом
 * остаётся тонкой «хлебной» панелью и не дублирует заголовок.
 */
export function PageHero({
  eyebrow,
  eyebrowIcon,
  title,
  lede,
  aside,
}: {
  eyebrow: ReactNode;
  eyebrowIcon?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="pg-dash__hero">
      <div className="pg-dash__hero-main">
        <p className="pg-dash__eyebrow">
          {eyebrowIcon}
          {eyebrow}
        </p>
        <h1 className="pg-dash__headline">{title}</h1>
        {lede ? <p className="pg-dash__lede">{lede}</p> : null}
      </div>
      {aside ? <div className="pg-dash__hero-aside">{aside}</div> : null}
    </header>
  );
}
