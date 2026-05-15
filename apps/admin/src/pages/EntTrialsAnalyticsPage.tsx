import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Empty, Select, Spin, Table, Typography } from 'antd';
import { DownloadOutlined, LineChartOutlined, TranslationOutlined } from '@ant-design/icons';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { HigTableCard } from '../components/HigBlocks';
import { getLocalizedText } from '../lib/questionContent';

type EntAnalytics = {
  entFound: boolean;
  completedSessions: number;
  last30Completed: number;
  avgScore: number | null;
  avgCorrectPercent: number | null;
  byLanguage: Array<{
    language: string;
    sessions: number;
    avgScore: number | null;
    avgRawScore: number | null;
  }>;
  bySubject: Array<{
    subjectId: string;
    subjectSlug: string;
    subjectName: unknown;
    sessions: number;
    answers: number;
    correctAnswers: number;
    accuracyPercent: number | null;
  }>;
};

type EntProfilePairs = {
  languages: string[];
  pairs: Array<{
    pairKey: string;
    profileSubjectIds: string[];
    profileSubjectSlugs: string[];
    profileSubjectNames: string[];
    label: string;
    sessions: number;
    avgRawScore: number | null;
    avgScore: number | null;
    byLanguage: Array<{
      language: string;
      sessions: number;
      avgRawScore: number | null;
      avgScore: number | null;
    }>;
  }>;
};

async function downloadCsv() {
  const response = await api.get('/admin/analytics/ent-trials/export', {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ent-trials-analytics.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function formatNumber(value: number | null | undefined, digits = 1) {
  return value != null ? Number(value).toFixed(digits) : '—';
}

export function EntTrialsAnalyticsPage() {
  const [language, setLanguage] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-ent'],
    queryFn: async () => (await api.get<EntAnalytics>('/admin/analytics/ent-trials')).data,
  });

  const { data: profilePairsData, isLoading: pairsLoading } = useQuery({
    queryKey: ['admin-analytics-ent-profile-pairs'],
    queryFn: async () => (await api.get<EntProfilePairs>('/admin/analytics/ent-profile-pairs')).data,
  });

  const filteredPairs = useMemo(() => {
    const pairs = profilePairsData?.pairs ?? [];
    if (language === 'all') return pairs;
    return pairs
      .map((pair) => {
        const langAgg = pair.byLanguage.find((item) => item.language === language);
        if (!langAgg) return null;
        return {
          ...pair,
          sessions: langAgg.sessions,
          avgRawScore: langAgg.avgRawScore,
          avgScore: langAgg.avgScore,
          selectedLanguage: language,
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((a, b) => b.sessions - a.sessions);
  }, [profilePairsData?.pairs, language]);

  const pairChartData = useMemo(
    () =>
      filteredPairs.slice(0, 10).map((pair) => ({
        name: pair.label,
        sessions: pair.sessions,
        avgRawScore: pair.avgRawScore != null ? Number(pair.avgRawScore.toFixed(1)) : 0,
        avgScore: pair.avgScore != null ? Number(pair.avgScore.toFixed(1)) : 0,
      })),
    [filteredPairs],
  );

  const languageOptions = useMemo(
    () => [
      { value: 'all', label: 'Все языки' },
      ...((profilePairsData?.languages ?? []).map((value) => ({ value, label: value.toUpperCase() })) ?? []),
    ],
    [profilePairsData?.languages],
  );

  const languageOverview = useMemo(() => {
    if (!data) return null;
    if (language === 'all') {
      return {
        sessions: data.completedSessions,
        avgScore: data.avgScore,
        avgRawScore:
          data.byLanguage.length > 0
            ? data.byLanguage.reduce((sum, item) => sum + (item.avgRawScore ?? 0) * item.sessions, 0) /
              Math.max(1, data.byLanguage.reduce((sum, item) => sum + item.sessions, 0))
            : null,
      };
    }
    const row = data.byLanguage.find((item) => item.language === language);
    return row
      ? {
          sessions: row.sessions,
          avgScore: row.avgScore,
          avgRawScore: row.avgRawScore,
        }
      : { sessions: 0, avgScore: null, avgRawScore: null };
  }, [data, language]);

  if (isLoading || pairsLoading) {
    return (
      <div className="admin-boot">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <AdminPageShell wide>
      <div className="pg-ent">
        <div className="pg-ent__head">
          <div>
            <p className="pg-ent__intro">
              Здесь теперь только полезный срез: <strong>профильные пары</strong>, распределение по языкам и понятные
              показатели по выбранному фильтру.
            </p>
          </div>
          <div className="pg-ent__actions">
            <Select
              value={language}
              onChange={setLanguage}
              options={languageOptions}
              prefix={<TranslationOutlined />}
              style={{ width: 180 }}
            />
            <Button icon={<DownloadOutlined />} onClick={downloadCsv}>
              Экспорт
            </Button>
          </div>
        </div>

        {!data?.entFound ? (
          <div className="pg-ent__empty">
            <Typography.Text>
              В каталоге экзаменов нет типа с идентификатором <code>ent</code>. Добавьте его в базе — тогда метрики
              заполнятся автоматически.
            </Typography.Text>
          </div>
        ) : (
          <div className="hig-inner-flow">
            <div className="pg-ent__strip">
              <div className="pg-ent__stat">
                <span className="pg-ent__stat-k">
                  <LineChartOutlined style={{ marginRight: 6 }} />
                  Сессий в срезе
                </span>
                <span className="pg-ent__stat-v">{languageOverview?.sessions ?? 0}</span>
              </div>
              <div className="pg-ent__stat">
                <span className="pg-ent__stat-k">Средний %</span>
                <span className="pg-ent__stat-v">{formatNumber(languageOverview?.avgScore)}</span>
              </div>
              <div className="pg-ent__stat">
                <span className="pg-ent__stat-k">Средний балл</span>
                <span className="pg-ent__stat-v">{formatNumber(languageOverview?.avgRawScore)}</span>
              </div>
              <div className="pg-ent__stat">
                <span className="pg-ent__stat-k">Профильных пар</span>
                <span className="pg-ent__stat-v">{filteredPairs.length}</span>
              </div>
            </div>

            <div className="pg-ent__grid">
              <Card
                title={language === 'all' ? 'Какие пары выбирают чаще всего' : `Топ пар — ${language.toUpperCase()}`}
                className="hig-chart-card"
              >
                {pairChartData.length === 0 ? (
                  <Empty description="Нет данных по выбранному языку" />
                ) : (
                  <div className="pg-ent__chart-block">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={pairChartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={170}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip />
                        <Bar dataKey="sessions" name="Сессий" fill="#2563eb" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              <Card
                title={language === 'all' ? 'Качество по языкам' : `Качество пар — ${language.toUpperCase()}`}
                className="hig-chart-card"
              >
                {language === 'all' ? (
                  <Table
                    size="small"
                    rowKey="language"
                    pagination={false}
                    dataSource={data.byLanguage}
                    columns={[
                      { title: 'Язык', dataIndex: 'language', render: (value: string) => value.toUpperCase() },
                      { title: 'Сессий', dataIndex: 'sessions', align: 'right' as const },
                      {
                        title: 'Средний %',
                        dataIndex: 'avgScore',
                        align: 'right' as const,
                        render: (value: number | null) => formatNumber(value),
                      },
                      {
                        title: 'Средний балл',
                        dataIndex: 'avgRawScore',
                        align: 'right' as const,
                        render: (value: number | null) => formatNumber(value),
                      },
                    ]}
                  />
                ) : pairChartData.length === 0 ? (
                  <Empty description="Нет данных по выбранному языку" />
                ) : (
                  <div className="pg-ent__chart-block">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={pairChartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={70} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avgScore" name="Средний %" fill="#f97316" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              <HigTableCard title={language === 'all' ? 'Все профильные пары' : `Пары по языку ${language.toUpperCase()}`}>
                <Table
                  size="small"
                  rowKey="pairKey"
                  dataSource={filteredPairs}
                  pagination={{ pageSize: 12, showSizeChanger: false }}
                  columns={[
                    {
                      title: 'Пара предметов',
                      dataIndex: 'label',
                      render: (value: string, row: EntProfilePairs['pairs'][number]) => (
                        <div className="pg-ent__pair-cell">
                          <strong>{value}</strong>
                          <small>{row.profileSubjectSlugs.join(' + ')}</small>
                        </div>
                      ),
                    },
                    {
                      title: 'Сессий',
                      dataIndex: 'sessions',
                      width: 100,
                      align: 'right' as const,
                    },
                    {
                      title: 'Средний балл',
                      dataIndex: 'avgRawScore',
                      width: 130,
                      align: 'right' as const,
                      render: (value: number | null) => formatNumber(value),
                    },
                    {
                      title: 'Средний %',
                      dataIndex: 'avgScore',
                      width: 110,
                      align: 'right' as const,
                      render: (value: number | null) => formatNumber(value),
                    },
                    {
                      title: language === 'all' ? 'Языки' : 'Комментарий',
                      key: 'languages',
                      render: (_value, row: EntProfilePairs['pairs'][number]) =>
                        language === 'all' ? (
                          <div className="pg-ent__pair-langs">
                            {row.byLanguage.map((item) => (
                              <span key={`${row.pairKey}-${item.language}`}>
                                {item.language.toUpperCase()}: {item.sessions}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="pg-ent__pair-langs">
                            {row.profileSubjectNames.join(' + ')} показывает {formatNumber(row.avgScore)}% в среднем
                          </span>
                        ),
                    },
                  ]}
                />
              </HigTableCard>

              <HigTableCard title="Предметная аналитика">
                <Table
                  size="small"
                  rowKey="subjectId"
                  dataSource={data.bySubject}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  columns={[
                    {
                      title: 'Предмет',
                      dataIndex: 'subjectName',
                      render: (name: unknown, row: EntAnalytics['bySubject'][number]) =>
                        getLocalizedText(name) || row.subjectSlug,
                    },
                    { title: 'Slug', dataIndex: 'subjectSlug', width: 150 },
                    { title: 'Сессий', dataIndex: 'sessions', width: 100, align: 'right' as const },
                    { title: 'Ответов', dataIndex: 'answers', width: 100, align: 'right' as const },
                    {
                      title: 'Верных',
                      dataIndex: 'correctAnswers',
                      width: 100,
                      align: 'right' as const,
                    },
                    {
                      title: 'Точность',
                      dataIndex: 'accuracyPercent',
                      width: 110,
                      align: 'right' as const,
                      render: (v: number | null) => (v != null ? `${Number(v).toFixed(1)}%` : '—'),
                    },
                  ]}
                />
              </HigTableCard>
            </div>
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
