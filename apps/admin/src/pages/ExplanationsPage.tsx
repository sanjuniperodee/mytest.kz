import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Table, Tag, Typography, Button, Space, Card, Segmented, Tabs, Empty, Skeleton } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import {
  ReadOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  TableOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { HigTableCard } from '../components/HigBlocks';
import {
  getLocalizedText,
  getQuestionContentLocale,
  getQuestionPreviewText,
  localeFilterParam,
  localeFilterToTabKey,
  tabKeyToLocaleFilter,
  LOCALE_TAB_KEYS,
  type AdminLocaleFilter,
} from '../lib/questionContent';

const PAGE_SIZE = 15;

function formatNowRu() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function filterLabel(f: AdminLocaleFilter) {
  if (f === '') return 'Все';
  if (f === 'kk') return 'KK';
  if (f === 'ru') return 'RU';
  return 'Без метки';
}

interface Row {
  id: string;
  examTypeId: string;
  subjectId: string;
  difficulty: number;
  type: string;
  content: unknown;
  explanation: unknown;
  metadata?: Record<string, unknown> | null;
  subject?: { name: unknown };
  examType?: { name: unknown };
}

function localeTag(locale: ReturnType<typeof getQuestionContentLocale>) {
  if (locale === 'kk') return <Tag color="gold">KK</Tag>;
  if (locale === 'ru') return <Tag color="cyan">RU</Tag>;
  return <Tag>—</Tag>;
}

export function ExplanationsPage() {
  const [page, setPage] = useState(1);
  const [localeFilter, setLocaleFilter] = useState<AdminLocaleFilter>('');
  const [previewLang, setPreviewLang] = useState<'kk' | 'ru'>('ru');

  const localeParams = useMemo(() => localeFilterParam(localeFilter), [localeFilter]);

  const { data, isFetching, isPending } = useQuery({
    queryKey: ['admin-questions-explanations', page, localeFilter],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/questions', {
        params: { hasExplanation: true, page, limit: PAGE_SIZE, ...localeParams },
      });
      return res as { items: Row[]; total: number; page: number; limit: number };
    },
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = data?.items ?? [];
  const showSkeleton = isPending && !data;

  const columns: ColumnsType<Row> = useMemo(
    () => [
      {
        title: 'Вопрос',
        render: (_: unknown, record: Row) => {
          const text = getQuestionPreviewText(record, previewLang) || '—';
          const s = String(text);
          return (
            <span>
              {s.slice(0, 100)}
              {s.length > 100 ? '…' : ''}
            </span>
          );
        },
      },
      {
        title: 'Язык',
        width: 88,
        render: (_: unknown, record: Row) => localeTag(getQuestionContentLocale(record.metadata)),
      },
      {
        title: 'Группа',
        width: 240,
        render: (_: unknown, record: Row) => (
          <Space size={4} wrap>
            <Tag color="blue">{getLocalizedText(record.examType?.name) || '—'}</Tag>
            <Tag color="purple">{getLocalizedText(record.subject?.name) || '—'}</Tag>
          </Space>
        ),
      },
      {
        title: 'Объяснение',
        width: 280,
        render: (_: unknown, record: Row) => {
          const text = getLocalizedText(record.explanation) || '—';
          const s = String(text);
          return (
            <span className="hig-cell-muted">
              {s.slice(0, 90)}
              {s.length > 90 ? '…' : ''}
            </span>
          );
        },
      },
      {
        title: '',
        width: 160,
        fixed: 'right',
        render: (_: unknown, record: Row) => (
          <Link to={`/questions?id=${record.id}`}>
            <Button type="link" size="small">
              К вопросам
            </Button>
          </Link>
        ),
      },
    ],
    [previewLang],
  );

  if (showSkeleton) {
    return (
      <AdminPageShell>
        <div className="pg-explanations">
          <Skeleton active className="pg-explanations__skeleton-hero" paragraph={{ rows: 0 }} />
          <div className="pg-explanations__stat-strip">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton.Button key={i} active block style={{ height: 86, borderRadius: 16 }} />
            ))}
          </div>
          <Skeleton active className="pg-explanations__skeleton-tools" paragraph={{ rows: 2 }} />
          <Skeleton active className="pg-explanations__skeleton-table" paragraph={{ rows: 6 }} />
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <div className="pg-explanations">
        <div className="pg-explanations__hero pg-dash__hero">
          <div>
            <p className="pg-dash__eyebrow">
              <ReadOutlined /> Банк вопросов
            </p>
            <h1 className="pg-dash__headline">Объяснения</h1>
            <p className="pg-dash__lede">
              Только вопросы с непустым полем объяснения. Фильтр по метке языка контента, превью условия KK/RU в таблице
              и переход в полный редактор со страницы вопросов.
            </p>
          </div>
          <div className="pg-dash__hero-aside">
            <span className="pg-dash__date">{formatNowRu()}</span>
            <span className={isFetching ? 'pg-dash__pill pg-dash__pill--sync' : 'pg-dash__pill'}>
              {isFetching ? (
                <>
                  <ThunderboltOutlined /> Обновление…
                </>
              ) : (
                'Данные на момент загрузки'
              )}
            </span>
          </div>
        </div>

        <div className="pg-explanations__stat-strip">
          <div className="pg-explanations__stat pg-explanations__stat--blue">
            <span className="pg-explanations__stat-icon">
              <ReadOutlined />
            </span>
            <div className="pg-explanations__stat-body">
              <span className="pg-explanations__stat-k">С объяснением (всего)</span>
              <span className="pg-explanations__stat-v">{total.toLocaleString('ru-RU')}</span>
            </div>
          </div>
          <div className="pg-explanations__stat pg-explanations__stat--violet">
            <span className="pg-explanations__stat-icon">
              <UnorderedListOutlined />
            </span>
            <div className="pg-explanations__stat-body">
              <span className="pg-explanations__stat-k">На странице</span>
              <span className="pg-explanations__stat-v">{items.length}</span>
            </div>
          </div>
          <div className="pg-explanations__stat pg-explanations__stat--teal">
            <span className="pg-explanations__stat-icon">
              <TableOutlined />
            </span>
            <div className="pg-explanations__stat-body">
              <span className="pg-explanations__stat-k">Номер страницы</span>
              <span className="pg-explanations__stat-v">
                {page} / {pageCount}
              </span>
            </div>
          </div>
          <div className="pg-explanations__stat pg-explanations__stat--amber">
            <span className="pg-explanations__stat-icon">
              <FilterOutlined />
            </span>
            <div className="pg-explanations__stat-body">
              <span className="pg-explanations__stat-k">Фильтр по языку</span>
              <span className="pg-explanations__stat-v pg-explanations__stat-v--sm">{filterLabel(localeFilter)}</span>
            </div>
          </div>
        </div>

        <div className="pg-explanations__toolbar pg-explanations__toolbar--accent">
          <div>
            <p className="pg-explanations__tool-label">Язык контента</p>
            <Tabs
              className="hig-page-tabs"
              activeKey={localeFilterToTabKey(localeFilter)}
              onChange={(key) => {
                setLocaleFilter(tabKeyToLocaleFilter(key));
                setPage(1);
                if (key === LOCALE_TAB_KEYS.kk) setPreviewLang('kk');
                if (key === LOCALE_TAB_KEYS.ru) setPreviewLang('ru');
              }}
              type="line"
              size="middle"
              items={[
                {
                  key: LOCALE_TAB_KEYS.all,
                  label: (
                    <span>
                      <strong>Барлығы</strong>
                      <Typography.Text type="secondary" style={{ marginLeft: 8, fontWeight: 400 }}>
                        / Все
                      </Typography.Text>
                    </span>
                  ),
                },
                {
                  key: LOCALE_TAB_KEYS.kk,
                  label: (
                    <span>
                      <Tag color="gold" style={{ marginRight: 8 }}>
                        KK
                      </Tag>
                      Қазақша
                    </span>
                  ),
                },
                {
                  key: LOCALE_TAB_KEYS.ru,
                  label: (
                    <span>
                      <Tag color="cyan" style={{ marginRight: 8 }}>
                        RU
                      </Tag>
                      Русский
                    </span>
                  ),
                },
                {
                  key: LOCALE_TAB_KEYS.unset,
                  label: 'Без метки',
                },
              ]}
            />
          </div>
          <div>
            <p className="pg-explanations__tool-label">Превью текста вопроса</p>
            <Card className="hig-filter-card" size="small" styles={{ body: { padding: '10px 14px' } }}>
              <Space wrap align="center">
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Язык превью условия в таблице
                </Typography.Text>
                <Segmented
                  value={previewLang}
                  onChange={(v) => setPreviewLang(v as 'kk' | 'ru')}
                  options={[
                    { label: 'KK', value: 'kk' },
                    { label: 'RU', value: 'ru' },
                  ]}
                />
              </Space>
            </Card>
          </div>
        </div>

        <div className="pg-explanations__list" aria-label="Список вопросов с объяснениями">
          <div className="pg-explanations__section-head">
            <h2 className="pg-explanations__section-title">Список</h2>
            <p className="pg-explanations__section-desc">
              Превью обрезано по длине; полный текст — в разделе вопросов. Пагинация по {PAGE_SIZE} строк.
            </p>
          </div>
          <HigTableCard className="pg-explanations__table-card">
            <Table<Row>
              size="small"
              rowKey="id"
              columns={columns}
              dataSource={items}
              loading={isFetching}
              pagination={{
                current: page,
                total,
                pageSize: PAGE_SIZE,
                onChange: setPage,
                showSizeChanger: false,
                showTotal: (t) => `${t.toLocaleString('ru-RU')} шт.`,
              }}
              locale={{
                emptyText: <Empty description="Нет записей по фильтру" />,
              }}
              scroll={{ x: 960 }}
            />
          </HigTableCard>
        </div>
      </div>
    </AdminPageShell>
  );
}
