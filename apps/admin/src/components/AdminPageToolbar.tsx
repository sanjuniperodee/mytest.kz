import type { ReactNode } from 'react';

/** Панель под заголовком страницы: фильтры, кнопки, без лишнего текста. */
export function AdminPageToolbar({ children, end }: { children?: ReactNode; end?: ReactNode }) {
  return (
    <div className="admin-page-toolbar">
      <div className="admin-page-toolbar-start">{children}</div>
      {end ? <div className="admin-page-toolbar-end">{end}</div> : null}
    </div>
  );
}
