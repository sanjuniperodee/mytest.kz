import { useQuery } from '@tanstack/react-query';
import { Spin, Typography } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';

export function EntTrialsAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-ent'],
    queryFn: async () => (await api.get('/admin/analytics/ent-trials')).data,
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
        <p className="pg-ent__intro">
          Агрегаты по <strong>завершённым</strong> сессиям типа <code>ent</code>: объёмы за всё время и за 30 дней,
          средний балл и доля верных ответов.
        </p>

        {!data?.entFound ? (
          <div className="pg-ent__empty">
            <Typography.Text>
              В каталоге экзаменов нет типа с идентификатором <code>ent</code>. Добавьте его в базе — тогда метрики
              заполнятся автоматически.
            </Typography.Text>
          </div>
        ) : (
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
        )}
      </div>
    </AdminPageShell>
  );
}
