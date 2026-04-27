import type { ReactNode } from 'react';
import { Card, type CardProps } from 'antd';

/** Вводный абзац под системным заголовком окна (HIG: secondary / footnote). */
export function HigPageLead({ children }: { children: ReactNode }) {
  return <p className="hig-page-lead">{children}</p>;
}

/**
 * Группа контента с подписью в стиле настроек macOS (uppercase label + тело).
 * Используйте для смысловых блоков на странице, не дублируя заголовок в шапке.
 */
export function HigGroup({
  label,
  description,
  children,
  className = '',
  bodyClassName = '',
}: {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={['hig-group', className].filter(Boolean).join(' ')}>
      <div className="hig-group__head">
        <h2 className="hig-group__label">{label}</h2>
        {description ? <p className="hig-group__desc">{description}</p> : null}
      </div>
      <div className={['hig-group__body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
    </section>
  );
}

/** Карточка с «врезанной» таблицей: без внутренних отступов у body, скругления как в iOS. */
export function HigTableCard({ children, className, styles, ...props }: CardProps) {
  return (
    <Card
      className={['hig-table-card', className].filter(Boolean).join(' ')}
      styles={{ ...styles, body: { padding: 0, ...styles?.body } }}
      {...props}
    >
      {children}
    </Card>
  );
}
