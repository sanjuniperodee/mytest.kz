import { useTranslation } from 'react-i18next';

type Tab = 'overview' | 'funnel' | 'visitors' | 'testTakers';

interface AdminNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function AdminNav({ activeTab, onTabChange }: AdminNavProps) {
  const { t } = useTranslation();

  const tabs: Tab[] = ['overview', 'funnel', 'visitors', 'testTakers'];
  const labels: Record<Tab, string> = {
    overview: t('admin.nav.overview'),
    funnel: t('admin.nav.funnel'),
    visitors: t('admin.nav.visitors'),
    testTakers: t('admin.nav.testTakers'),
  };

  return (
    <nav className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab
              ? 'border-b-2 border-violet-600 text-violet-600'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          {labels[tab]}
        </button>
      ))}
    </nav>
  );
}
