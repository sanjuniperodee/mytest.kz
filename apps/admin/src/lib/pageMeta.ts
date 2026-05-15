/** Метаданные экрана для глобальной шапки админки. */
export type AdminPageTitle = {
  title: string;
  section: string;
  description: string;
};

export function getPageMeta(pathname: string): AdminPageTitle {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p.startsWith('/dashboard')) {
    return {
      title: 'Панель',
      section: 'Старт',
      description: 'Ключевые показатели, новые пользователи и быстрые переходы по важным потокам.',
    };
  }
  if (p.startsWith('/analytics/ent')) {
    return {
      title: 'Пробные ЕНТ',
      section: 'Метрики',
      description: 'Динамика сдач, качество попыток и сигналы по подготовке к ЕНТ.',
    };
  }
  if (p.startsWith('/analytics/thresholds')) {
    return {
      title: 'Пороги в вузы',
      section: 'Метрики',
      description: 'Контроль проходных баллов и ориентиры для поступления по программам.',
    };
  }
  if (p.startsWith('/analytics')) {
    return {
      title: 'Аналитика',
      section: 'Метрики',
      description: 'Воронка платформы, продуктовые срезы и состояние основных сценариев.',
    };
  }
  if (p.startsWith('/admission')) {
    return {
      title: 'Шанс поступления',
      section: 'Сервис',
      description: 'Настройки и аналитика по расчёту вероятности поступления.',
    };
  }
  if (p.startsWith('/explanations')) {
    return {
      title: 'Объяснения',
      section: 'Каталог',
      description: 'Редактор пояснений и материалов, которые видит ученик после разбора.',
    };
  }
  if (p.startsWith('/users')) {
    return {
      title: 'Пользователи',
      section: 'Аккаунты',
      description: 'Доступы, роли, история активности и сопровождение аккаунтов.',
    };
  }
  if (p.startsWith('/questions')) {
    return {
      title: 'Вопросы',
      section: 'Каталог',
      description: 'Банк заданий, языки контента, экспорт и точечное редактирование.',
    };
  }
  if (p.startsWith('/exams')) {
    return {
      title: 'Экзамены',
      section: 'Каталог',
      description: 'Структура экзаменов, шаблоны и наборы для генерации пользовательских сессий.',
    };
  }
  if (p.startsWith('/subscriptions')) {
    return {
      title: 'Подписки',
      section: 'Аккаунты',
      description: 'Управление активными тарифами, сроками и ручными выдачами доступа.',
    };
  }
  if (p.startsWith('/notifications')) {
    return {
      title: 'Рассылки',
      section: 'Аккаунты',
      description: 'Коммуникации, push-сценарии и операционные уведомления для пользователей.',
    };
  }
  if (p.startsWith('/landing-settings')) {
    return {
      title: 'Лендинг',
      section: 'Каталог',
      description: 'Контент первого экрана, медиа и публичные настройки маркетинговых страниц.',
    };
  }
  return {
    title: 'Админка',
    section: 'Панель',
    description: 'Операционная среда MyTest для команды, контента и продуктовой аналитики.',
  };
}
