import type { ReactNode } from 'react';

/**
 * Ограничивает ширину контента на широких экранах, выравнивает отступы.
 * Весь кроме панели с таблицами на весь жир — используй `wide` для форм/настроек.
 */
export function AdminPageShell({
  children,
  wide,
  className = '',
}: {
  children: ReactNode;
  /** Уже разметка (подписки, длинные формы) */
  wide?: boolean;
  className?: string;
}) {
  const cls = ['admin-page', wide && 'admin-page--wide', className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}
