/** Заголовок в шапке и группа в «хлебных крошках» по пути. */
export type AdminPageMeta = {
  section: string;
  title: string;
};

export function getPageMeta(pathname: string): AdminPageMeta {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p.startsWith('/dashboard')) {
    return { section: 'Сводка', title: 'Панель' };
  }
  if (p.startsWith('/analytics/ent')) {
    return { section: 'Аналитика', title: 'Пробные ЕНТ' };
  }
  if (p.startsWith('/analytics/thresholds')) {
    return { section: 'Аналитика', title: 'Пороги в вузы' };
  }
  if (p.startsWith('/analytics')) {
    return { section: 'Аналитика', title: 'Платформа' };
  }
  if (p.startsWith('/admission')) {
    return { section: 'Инструменты', title: 'Калькулятор шанса' };
  }
  if (p.startsWith('/explanations')) {
    return { section: 'Контент', title: 'Объяснения' };
  }
  if (p.startsWith('/users')) {
    return { section: 'Пользователи', title: 'Список' };
  }
  if (p.startsWith('/questions')) {
    return { section: 'Контент', title: 'Вопросы' };
  }
  if (p.startsWith('/exams')) {
    return { section: 'Контент', title: 'Экзамены' };
  }
  if (p.startsWith('/subscriptions')) {
    return { section: 'Пользователи', title: 'Подписки' };
  }
  if (p.startsWith('/landing-settings')) {
    return { section: 'Сайт', title: 'Лендинг' };
  }
  return { section: 'Админка', title: 'Раздел' };
}
