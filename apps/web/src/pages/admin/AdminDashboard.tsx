import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFunnel } from './hooks/useFunnel';
import { useVisitors } from './hooks/useVisitors';
import { useTestTakers } from './hooks/useTestTakers';
import { FunnelChart } from './components/FunnelChart';
import { DateRangePicker } from './components/DateRangePicker';
import { AdminNav } from './components/AdminNav';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Tab = 'overview' | 'funnel' | 'visitors' | 'testTakers';

function toDateStr(daysAgo: number) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().split('T')[0];
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [from, setFrom] = useState(toDateStr(30));
  const [to, setTo] = useState(toDateStr(0));
  const [visitorPage, setVisitorPage] = useState(1);
  const [takerPage, setTakerPage] = useState(1);

  const { data: funnelData, isLoading: funnelLoading } = useFunnel({ from, to });
  const { data: visitorsData, isLoading: visitorsLoading } = useVisitors({ page: visitorPage, limit: 50, from, to });
  const { data: testTakersData, isLoading: takersLoading } = useTestTakers({ page: takerPage, limit: 50, from, to });

  const applyFilters = () => {
    setVisitorPage(1);
    setTakerPage(1);
  };

  const resetFilters = () => {
    setFrom(toDateStr(30));
    setTo(toDateStr(0));
    setVisitorPage(1);
    setTakerPage(1);
  };

  const conversionRates = funnelData?.conversionRates;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {t('admin.overview.title')}
          </h1>
        </div>

        <div className="mb-4">
          <DateRangePicker
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            onApply={applyFilters}
            onReset={resetFilters}
          />
        </div>

        <AdminNav activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {funnelLoading ? (
                <div className="text-zinc-500">{t('admin.table.loading')}</div>
              ) : funnelData ? (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    { label: t('admin.overview.visitors'), value: funnelData.totals.visits },
                    { label: t('admin.overview.registered'), value: funnelData.totals.registered },
                    { label: t('admin.overview.startedTest'), value: funnelData.totals.started },
                    { label: t('admin.overview.completedTest'), value: funnelData.totals.completed },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="text-sm text-zinc-500">{label}</div>
                      <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {value.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'funnel' && (
            <div className="space-y-6">
              {funnelLoading ? (
                <div className="text-zinc-500">{t('admin.table.loading')}</div>
              ) : funnelData ? (
                <>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {[
                      { label: t('admin.funnel.visitToRegistered'), value: conversionRates?.visitToRegistered ?? 0 },
                      { label: t('admin.funnel.registeredToStarted'), value: conversionRates?.registeredToStarted ?? 0 },
                      { label: t('admin.funnel.startedToCompleted'), value: conversionRates?.startedToCompleted ?? 0 },
                      { label: t('admin.funnel.visitToCompleted'), value: conversionRates?.visitToCompleted ?? 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="text-sm text-zinc-500">{label}</div>
                        <div className="mt-1 text-2xl font-bold text-violet-600">{value}%</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="mb-4 text-sm font-medium text-zinc-500">{t('admin.funnel.title')}</h3>
                    <FunnelChart data={funnelData} />
                  </div>
                  {funnelData.byDate.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                      <h3 className="mb-4 text-sm font-medium text-zinc-500">Daily Trend</h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={funnelData.byDate}>
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.split('T')[0].slice(5)} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="visits" stroke="#7c3aed" dot={false} name="Visits" />
                            <Line type="monotone" dataKey="completed" stroke="#a78bfa" dot={false} name="Completed" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

          {activeTab === 'visitors' && (
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="px-4 py-3 text-zinc-500">{t('admin.visitors.visitorId')}</th>
                      <th className="px-4 py-3 text-zinc-500">{t('admin.visitors.user')}</th>
                      <th className="px-4 py-3 text-zinc-500">{t('admin.visitors.firstSeen')}</th>
                      <th className="px-4 py-3 text-zinc-500">{t('admin.visitors.steps')}</th>
                      <th className="px-4 py-3 text-zinc-500 text-right">{t('admin.visitors.completedTests')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitorsLoading ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">{t('admin.table.loading')}</td></tr>
                    ) : visitorsData?.items.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">{t('admin.table.noData')}</td></tr>
                    ) : (
                      visitorsData?.items.map((v) => (
                        <tr key={v.visitorId} className="border-b border-zinc-100 dark:border-zinc-800">
                          <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{v.visitorId.slice(0, 8)}…</td>
                          <td className="px-4 py-2.5">
                            {v.user ? (
                              <span className="text-zinc-900 dark:text-zinc-100">
                                {v.user.firstName} {v.user.lastName}
                                <span className="ml-1 text-zinc-400">@{v.user.telegramUsername}</span>
                              </span>
                            ) : (
                              <span className="text-zinc-400">{t('admin.visitors.noUser')}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-zinc-500">{new Date(v.firstSeen).toLocaleDateString()}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1">
                              {v.steps.map((step: string) => (
                                <span key={step} className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                                  {step}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-zinc-600">{v.completedSessions.length}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {visitorsData && visitorsData.total > 50 && (
                <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <span className="text-sm text-zinc-500">
                    {t('admin.table.showing', { from: ((visitorPage - 1) * 50) + 1, to: Math.min(visitorPage * 50, visitorsData.total), total: visitorsData.total })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVisitorPage((p) => Math.max(1, p - 1))}
                      disabled={visitorPage === 1}
                      className="rounded-lg border border-zinc-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
                    >
                      {t('common.back')}
                    </button>
                    <button
                      onClick={() => setVisitorPage((p) => p + 1)}
                      disabled={visitorPage * 50 >= visitorsData.total}
                      className="rounded-lg border border-zinc-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
                    >
                      {t('common.next')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'testTakers' && (
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="px-4 py-3 text-zinc-500">Telegram</th>
                      <th className="px-4 py-3 text-zinc-500">{t('admin.testTakers.name')}</th>
                      <th className="px-4 py-3 text-zinc-500 text-right">{t('admin.testTakers.testsCompleted')}</th>
                      <th className="px-4 py-3 text-zinc-500 text-right">{t('admin.testTakers.lastTest')}</th>
                      <th className="px-4 py-3 text-zinc-500 text-right">{t('admin.testTakers.bestScore')}</th>
                      <th className="px-4 py-3 text-zinc-500 text-right">{t('admin.testTakers.avgScore')}</th>
                      <th className="px-4 py-3 text-zinc-500 text-right">{t('admin.testTakers.avgDuration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {takersLoading ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">{t('admin.table.loading')}</td></tr>
                    ) : testTakersData?.items.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">{t('admin.table.noData')}</td></tr>
                    ) : (
                      testTakersData?.items.map((u) => (
                        <tr key={u.userId} className="border-b border-zinc-100 dark:border-zinc-800">
                          <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{u.telegramId}</td>
                          <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">
                            {u.firstName} {u.lastName}
                            <span className="ml-1 text-zinc-400">@{u.telegramUsername}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-zinc-600">{u.testsCompleted}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-500">
                            {u.lastTestAt ? new Date(u.lastTestAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
                            {u.bestScore != null ? `${u.bestScore}%` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-zinc-600">
                            {u.avgScore != null ? `${u.avgScore}%` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-zinc-500">
                            {u.avgDurationSecs != null ? `${Math.round(u.avgDurationSecs / 60)}m` : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {testTakersData && testTakersData.total > 50 && (
                <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <span className="text-sm text-zinc-500">
                    {t('admin.table.showing', { from: ((takerPage - 1) * 50) + 1, to: Math.min(takerPage * 50, testTakersData.total), total: testTakersData.total })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTakerPage((p) => Math.max(1, p - 1))}
                      disabled={takerPage === 1}
                      className="rounded-lg border border-zinc-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
                    >
                      {t('common.back')}
                    </button>
                    <button
                      onClick={() => setTakerPage((p) => p + 1)}
                      disabled={takerPage * 50 >= testTakersData.total}
                      className="rounded-lg border border-zinc-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
                    >
                      {t('common.next')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
