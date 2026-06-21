import type { ReactNode } from 'react';
import type { MenuProps } from 'antd';
import {
  UserOutlined,
  CrownOutlined,
  DashboardOutlined,
  LineChartOutlined,
  BookOutlined,
  RocketOutlined,
  FundProjectionScreenOutlined,
  AppstoreOutlined,
  CreditCardOutlined,
  ReadOutlined,
  FormOutlined,
  GlobalOutlined,
  NotificationOutlined,
  FlagOutlined,
} from '@ant-design/icons';

/**
 * Единый источник правды для навигации админки.
 *
 * Один список `NAV_ITEMS` управляет сразу: пунктами меню (сайдбар + мобильный
 * Drawer), подсветкой активного раздела по URL, метаданными глобальной шапки
 * и сопоставлением ключ ⇄ путь. Раньше это было размазано по четырём местам
 * (`menuItems`, `MENU_NAV`, `menuKeyFromPath`, `pageMeta.ts`) и расходилось.
 */

/** Группы меню в порядке отображения; они же — секция в шапке страницы. */
export const NAV_GROUPS = ['Старт', 'Метрики', 'Каталог', 'Аккаунты', 'Сервис'] as const;

export type NavGroup = (typeof NAV_GROUPS)[number];

export interface NavItem {
  /** Стабильный ключ пункта меню. */
  key: string;
  /** Базовый путь раздела (по нему же матчится активный пункт). */
  path: string;
  /** Группа в сайдбаре и секция-надзаголовок в шапке. */
  group: NavGroup;
  /** Короткая подпись в сайдбаре. */
  menuLabel: string;
  icon: ReactNode;
  /** Полный заголовок страницы в глобальной шапке. */
  title: string;
  /** Подзаголовок-описание страницы. */
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    path: '/dashboard',
    group: 'Старт',
    menuLabel: 'Панель',
    icon: <DashboardOutlined />,
    title: 'Панель',
    description:
      'Ключевые показатели, новые пользователи и быстрые переходы по важным потокам.',
  },
  {
    key: 'analytics-platform',
    path: '/analytics',
    group: 'Метрики',
    menuLabel: 'Воронка',
    icon: <FundProjectionScreenOutlined />,
    title: 'Аналитика',
    description: 'Воронка платформы, продуктовые срезы и состояние основных сценариев.',
  },
  {
    key: 'analytics-ent',
    path: '/analytics/ent',
    group: 'Метрики',
    menuLabel: 'ЕНТ',
    icon: <LineChartOutlined />,
    title: 'Пробные ЕНТ',
    description: 'Динамика сдач, качество попыток и сигналы по подготовке к ЕНТ.',
  },
  {
    key: 'analytics-thresholds',
    path: '/analytics/thresholds',
    group: 'Метрики',
    menuLabel: 'Пороги',
    icon: <BookOutlined />,
    title: 'Пороги в вузы',
    description: 'Контроль проходных баллов и ориентиры для поступления по программам.',
  },
  {
    key: 'questions',
    path: '/questions',
    group: 'Каталог',
    menuLabel: 'Вопросы',
    icon: <FormOutlined />,
    title: 'Вопросы',
    description: 'Банк заданий, языки контента, экспорт и точечное редактирование.',
  },
  {
    key: 'explanations',
    path: '/explanations',
    group: 'Каталог',
    menuLabel: 'Объяснения',
    icon: <ReadOutlined />,
    title: 'Объяснения',
    description: 'Редактор пояснений и материалов, которые видит ученик после разбора.',
  },
  {
    key: 'appeals',
    path: '/appeals',
    group: 'Каталог',
    menuLabel: 'Апелляции',
    icon: <FlagOutlined />,
    title: 'Апелляции',
    description:
      'Проверка спорных вопросов, ответы команде и полный контекст пользовательских обращений.',
  },
  {
    key: 'ai-lesson-notes',
    path: '/ai-lesson-notes',
    group: 'Каталог',
    menuLabel: 'AI-уроки',
    icon: <ReadOutlined />,
    title: 'AI-уроки',
    description:
      'Очередь замечаний к сохранённым AI-урокам и контроль исправления учебного материала.',
  },
  {
    key: 'exams',
    path: '/exams',
    group: 'Каталог',
    menuLabel: 'Экзамены',
    icon: <AppstoreOutlined />,
    title: 'Экзамены',
    description: 'Структура экзаменов, шаблоны и наборы для генерации пользовательских сессий.',
  },
  {
    key: 'landing-settings',
    path: '/landing-settings',
    group: 'Каталог',
    menuLabel: 'Лендинг',
    icon: <GlobalOutlined />,
    title: 'Лендинг',
    description: 'Контент первого экрана, медиа и публичные настройки маркетинговых страниц.',
  },
  {
    key: 'users',
    path: '/users',
    group: 'Аккаунты',
    menuLabel: 'Пользователи',
    icon: <UserOutlined />,
    title: 'Пользователи',
    description: 'Доступы, роли, история активности и сопровождение аккаунтов.',
  },
  {
    key: 'subscriptions',
    path: '/subscriptions',
    group: 'Аккаунты',
    menuLabel: 'Подписки',
    icon: <CrownOutlined />,
    title: 'Подписки',
    description: 'Управление активными тарифами, сроками и ручными выдачами доступа.',
  },
  {
    key: 'finance',
    path: '/finance',
    group: 'Аккаунты',
    menuLabel: 'Финансы',
    icon: <CreditCardOutlined />,
    title: 'Финансы',
    description:
      'Платежи, статусы заказов, выручка и контроль того, что покупка доведена до подписки.',
  },
  {
    key: 'notifications',
    path: '/notifications',
    group: 'Аккаунты',
    menuLabel: 'Рассылки',
    icon: <NotificationOutlined />,
    title: 'Рассылки',
    description: 'Коммуникации, push-сценарии и операционные уведомления для пользователей.',
  },
  {
    key: 'admission',
    path: '/admission',
    group: 'Сервис',
    menuLabel: 'Шанс',
    icon: <RocketOutlined />,
    title: 'Шанс поступления',
    description: 'Настройки и аналитика по расчёту вероятности поступления.',
  },
];

const DEFAULT_KEY = 'dashboard';

/** true, если `pathname` лежит внутри раздела `base` (с учётом границы сегмента). */
function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Активный пункт меню по URL — берём самый длинный (специфичный) совпавший путь. */
export function navItemFromPath(pathname: string): NavItem | undefined {
  const p = pathname.replace(/\/+$/, '') || '/';
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    if (isUnder(p, item.path) && (!best || item.path.length > best.path.length)) {
      best = item;
    }
  }
  return best;
}

export function navKeyFromPath(pathname: string): string {
  return navItemFromPath(pathname)?.key ?? DEFAULT_KEY;
}

export function pathForKey(key: string): string | undefined {
  return NAV_ITEMS.find((item) => item.key === key)?.path;
}

export interface PageMeta {
  title: string;
  section: string;
  description: string;
}

export function pageMetaFromPath(pathname: string): PageMeta {
  const item = navItemFromPath(pathname);
  if (item) {
    return { title: item.title, section: item.group, description: item.description };
  }
  return {
    title: 'Админка',
    section: 'Панель',
    description: 'Операционная среда MyTest для команды, контента и продуктовой аналитики.',
  };
}

/** Пункты для Ant Design `Menu`, сгруппированные в порядке `NAV_GROUPS`. */
export function buildMenuItems(): MenuProps['items'] {
  return NAV_GROUPS.map((group) => ({
    type: 'group' as const,
    label: group,
    children: NAV_ITEMS.filter((item) => item.group === group).map((item) => ({
      key: item.key,
      icon: item.icon,
      label: item.menuLabel,
    })),
  }));
}
