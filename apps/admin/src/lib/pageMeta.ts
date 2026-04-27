/** Один заголовок в шапке (без дублирования с меню). */
export type AdminPageTitle = { title: string };

export function getPageMeta(pathname: string): AdminPageTitle {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p.startsWith('/dashboard')) return { title: 'Панель' };
  if (p.startsWith('/analytics/ent')) return { title: 'Пробные ЕНТ' };
  if (p.startsWith('/analytics/thresholds')) return { title: 'Пороги в вузы' };
  if (p.startsWith('/analytics')) return { title: 'Аналитика' };
  if (p.startsWith('/admission')) return { title: 'Шанс поступления' };
  if (p.startsWith('/explanations')) return { title: 'Объяснения' };
  if (p.startsWith('/users')) return { title: 'Пользователи' };
  if (p.startsWith('/questions')) return { title: 'Вопросы' };
  if (p.startsWith('/exams')) return { title: 'Экзамены' };
  if (p.startsWith('/subscriptions')) return { title: 'Подписки' };
  if (p.startsWith('/landing-settings')) return { title: 'Лендинг' };
  return { title: 'Админка' };
}
