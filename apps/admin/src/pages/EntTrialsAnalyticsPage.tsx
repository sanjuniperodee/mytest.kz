import { useQuery } from '@tanstack/react-query';
import { Button, Card, Spin, Table, Typography } from 'antd';
import { DownloadOutlined, LineChartOutlined } from '@ant-design/icons';
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
  pairs: Array<{
    profileSubjects: string;
    sessions: number;
    avgRawScore: number | null;
    avgScore: number | null;
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

export function EntTrialsAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-ent'],
    queryFn: async () => (await api.get<EntAnalytics>('/admin/analytics/ent-trials')).data,
  });

  const { data: profilePairsData } = useQuery({
    queryKey: ['admin-analytics-ent-profile-pairs'],
    queryFn: async () => (await api.get<EntProfilePairs>('/admin/analytics/ent-profile-pairs')).data,
  });

  if (isLoading) {
    return (
      <div className="admin-boot">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <AdminPageShell>
      <div className="pg-ent">
        <div className="pg-ent__head">
          <p className="pg-ent__intro">
            Агрегаты по <strong>завершённым</strong> сессиям типа <code>ent</code>: объёмы, средний балл, языки и
            предметная точность.
          </p>
          <Button icon={<DownloadOutlined />} onClick={downloadCsv}>
            Экспорт
          </Button>
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
                  Завершено всего
                </span>
                <span className="pg-ent__stat-v">{data.completedSessions}</span>
              </div>
              <div className="pg-ent__stat">
                <span className="pg-ent__stat-k">За 30 дней</span>
                <span className="pg-ent__stat-v">{data.last30Completed}</span>
              </div>
              <div className="pg-ent__stat">
                <span className="pg-ent__stat-k">Средний балл</span>
                <span className="pg-ent__stat-v">{data.avgScore != null ? Number(data.avgScore).toFixed(2) : '—'}</span>
              </div>
              <div className="pg-ent__stat">
                <span className="pg-ent__stat-k">Средний % верных</span>
                <span className="pg-ent__stat-v">
                  {data.avgCorrectPercent != null ? `${Number(data.avgCorrectPercent).toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>

            <div className="pg-ent__grid">
              <Card title="Языки пробных" className="hig-chart-card">
                <Table
                  size="small"
                  rowKey="language"
                  pagination={false}
                  dataSource={data.byLanguage}
                  columns={[
                    { title: 'Язык', dataIndex: 'language' },
                    { title: 'Сессий', dataIndex: 'sessions', align: 'right' as const },
                    {
                      title: 'Средний %',
                      dataIndex: 'avgScore',
                      align: 'right' as const,
                      render: (v: number | null) => (v != null ? Number(v).toFixed(1) : '—'),
                    },
                    {
                      title: 'Средний балл',
                      dataIndex: 'avgRawScore',
                      align: 'right' as const,
                      render: (v: number | null) => (v != null ? Number(v).toFixed(1) : '—'),
                    },
                  ]}
                />
              </Card>

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

              {profilePairsData && profilePairsData.pairs.length > 0 && (
                <HigTableCard title="Профильные пары">
                  <Table
                    size="small"
                    rowKey="profileSubjects"
                    dataSource={profilePairsData.pairs}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    columns={[
                      {
                        title: 'Профильные предметы',
                        dataIndex: 'profileSubjects',
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
                        render: (v: number | null) => (v != null ? Number(v).toFixed(1) : '—'),
                      },
                      {
                        title: 'Средний %',
                        dataIndex: 'avgScore',
                        width: 110,
                        align: 'right' as const,
                        render: (v: number | null) => (v != null ? Number(v).toFixed(1) : '—'),
                      },
                    ]}
                  />
                </HigTableCard>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
