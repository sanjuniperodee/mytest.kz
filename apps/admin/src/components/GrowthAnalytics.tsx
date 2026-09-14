import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Row, Statistic, Table, Typography } from 'antd';
import { api } from '../api/client';

type Report = {
  cohort: { registered: number; started: number; finished: number; paid: number };
  revenue: { paid_orders: number; buyers: number; gross_kzt: number };
  survey: { eligible: number; shown: number; submitted: number; skipped: number; average_rating: number | null };
  payments: { provider: string; status: string; orders: number; buyers: number; amount: number }[];
  events: { step: string; events: number; users: number }[];
  checkoutErrors: { provider: string; reason: string; events: number; users: number }[];
  blockers: { blocker: string; intent: string; responses: number }[];
  responses: { sessionId: string; rating: number; blocker: string; intent: string; comment: string | null; submittedAt: string; locale: string }[];
  total: number;
};
const reasons: Record<string,string> = { price: 'Цена', value: 'Не видит пользы', payment: 'Не получается оплатить', trust: 'Сомнения в качестве', later: 'Не сейчас / нет времени', other: 'Другое', none: 'Ничего не мешает' };
const intents: Record<string,string> = { yes: 'Да', maybe: 'Не решил(а)', no: 'Нет', already_paid: 'Уже купил(а)' };
const percent = (n: number, d: number) => d ? `${(100*n/d).toFixed(1)}%` : '—';

export function GrowthAnalytics({ from, to }: { from: string; to: string }) {
  const [page, setPage] = useState(1);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['growth-analytics', from, to, page],
    queryFn: async () => (await api.get<Report>('/admin/analytics/growth', { params: { from, to, page } })).data,
  });
  if (error) return <Alert type="error" message="Не удалось загрузить аналитику продаж" action={<Button onClick={() => void refetch()}>Повторить</Button>} />;
  if (!data) return <Card loading={isLoading} />;
  const c = data.cohort;
  return <div style={{ display: 'grid', gap: 20 }}>
    <Alert type="info" message="Оплаты — из базы заказов, а не клиентских событий. Исключены администраторы. Даты включают весь день по Алматы." />
    <Row gutter={[16,16]}>
      {[['Оплачено заказов', data.revenue.paid_orders], ['Покупатели', data.revenue.buyers], ['Валовые оплаты, ₸', data.revenue.gross_kzt]].map(([title,value]) => <Col xs={24} md={8} key={String(title)}><Card><Statistic title={title} value={value} /></Card></Col>)}
    </Row>
    <Card title="Когорта новых пользователей">
      <Typography.Paragraph type="secondary">Зарегистрировались в выбранном периоде → начали пробный → завершили (включая таймер) → оплатили после завершения. Каждый этап — подмножество предыдущего; учитываются действия до конца периода. Молодые когорты ещё могут купить позже.</Typography.Paragraph>
      <Table pagination={false} size="small" rowKey="stage" dataSource={[
        { stage: 'Зарегистрировались', users: c.registered, conversion: '—' },
        { stage: 'Начали пробный', users: c.started, conversion: percent(c.started,c.registered) },
        { stage: 'Завершили пробный', users: c.finished, conversion: percent(c.finished,c.started) },
        { stage: 'Оплатили после пробного', users: c.paid, conversion: percent(c.paid,c.finished) },
      ]} columns={[{ title:'Этап', dataIndex:'stage' }, { title:'Пользователей', dataIndex:'users' }, { title:'От предыдущего этапа', dataIndex:'conversion' }]} />
    </Card>
    <Card title="Заказы, созданные в периоде">
      <Typography.Paragraph type="secondary">Это статусы заказов на сейчас, а не последовательная воронка. Сумма включает неоплаченные заказы. Валовые оплаты выше считаются по дате оплаты, без вычета возвратов.</Typography.Paragraph>
      <Table size="small" pagination={false} rowKey={(r) => `${r.provider}:${r.status}`} dataSource={data.payments} columns={[
        { title:'Провайдер', dataIndex:'provider' }, { title:'Статус', dataIndex:'status' }, { title:'Заказов', dataIndex:'orders' }, { title:'Пользователей', dataIndex:'buyers' }, { title:'Сумма', dataIndex:'amount' },
      ]} />
    </Card>
    <Card title="Фидбек после пробного">
      <Typography.Paragraph type="secondary">Покрытие опросом: {percent(data.survey.shown, data.survey.eligible)}. Ответили от завершивших: {percent(data.survey.submitted,data.survey.eligible)}.</Typography.Paragraph>
      <Typography.Paragraph>Для пробных, завершённых в периоде: {data.survey.eligible}. Опрос увидели: {data.survey.shown}. Ответили: {data.survey.submitted}; пропустили: {data.survey.skipped}. Средняя оценка: {data.survey.average_rating?.toFixed(1) ?? '—'}/5.</Typography.Paragraph>
      <Typography.Paragraph type="secondary">Ответы этой когорты учитываются по состоянию на сейчас. Низкие оценки и причины покупки — добровольные ответы, а не мнение всех пользователей.</Typography.Paragraph>
      <Table size="small" pagination={false} rowKey={(r) => `${r.blocker}:${r.intent}`} dataSource={data.blockers} columns={[
        { title:'Что мешает (ответы за период)', dataIndex:'blocker', render:(value: string) => reasons[value] || value },
        { title:'Планирует покупку', dataIndex:'intent', render:(value: string) => intents[value] || value },
        { title:'Ответов', dataIndex:'responses' },
      ]} />
    </Card>
    <Card title="Отзывы, отправленные в периоде">
      <Table size="small" scroll={{ x: 650 }} rowKey="sessionId" dataSource={data.responses} pagination={{ current:page, pageSize:25, total:data.total, showSizeChanger:false, onChange:setPage }} columns={[
        { title:'Дата', dataIndex:'submittedAt', render:(v: string) => new Date(v).toLocaleString('ru-RU', { timeZone:'Asia/Almaty' }) },
        { title:'Оценка', dataIndex:'rating' }, { title:'Причина', dataIndex:'blocker', render:(v: string) => reasons[v] || v },
        { title:'Комментарий', dataIndex:'comment', render:(v: string) => <span style={{ whiteSpace:'pre-wrap', overflowWrap:'anywhere' }}>{v || '—'}</span> },
      ]} />
    </Card>
    <Card title="События интерфейса: отдельные охваты">
      <Typography.Paragraph type="secondary">Уникальные авторизованные пользователи каждого события. Эти группы могут не пересекаться: делить их друг на друга как этапы воронки нельзя.</Typography.Paragraph>
      <Table size="small" rowKey="step" pagination={false} dataSource={data.events} columns={[{ title:'Событие', dataIndex:'step' }, { title:'Событий', dataIndex:'events' }, { title:'Пользователей', dataIndex:'users' }]} />
    </Card>
    <Card title="Ошибки оформления оплаты">
      <Table size="small" rowKey={(r) => `${r.provider}:${r.reason}`} pagination={false} dataSource={data.checkoutErrors} columns={[
        { title:'Провайдер', dataIndex:'provider' }, { title:'Причина', dataIndex:'reason' }, { title:'Событий', dataIndex:'events' }, { title:'Пользователей', dataIndex:'users' },
      ]} />
    </Card>
  </div>;
}
