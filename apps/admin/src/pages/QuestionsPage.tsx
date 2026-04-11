import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Space,
  Tag,
  message,
  Empty,
  Card,
  Segmented,
  Typography,
  Tooltip,
  Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, GlobalOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';
import {
  getLocalizedText,
  getQuestionContentLocale,
  getQuestionPreviewText,
  localeFilterParam,
} from '../lib/questionContent';

const { TextArea } = Input;

type LocaleFilter = '' | 'kk' | 'ru' | 'unset';

interface Question {
  id: string;
  examTypeId: string;
  subjectId: string;
  topicId: string;
  difficulty: number;
  type: string;
  content: unknown;
  explanation: unknown;
  metadata?: Record<string, unknown> | null;
  isActive: boolean;
  answerOptions: { id: string; content: unknown; isCorrect: boolean; sortOrder: number }[];
  subject?: { id: string; name: unknown; slug: string };
  examType?: { id: string; name: unknown; slug: string };
  topic?: { id: string; name: unknown };
}

function localeTag(locale: ReturnType<typeof getQuestionContentLocale>) {
  if (locale === 'kk') return <Tag color="gold">Қазақша</Tag>;
  if (locale === 'ru') return <Tag color="cyan">Русский</Tag>;
  return <Tag color="default">Нет метки</Tag>;
}

export function QuestionsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('id');
  const [page, setPage] = useState(1);
  const [examTypeId, setExamTypeId] = useState<string | undefined>();
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [localeFilter, setLocaleFilter] = useState<LocaleFilter>('');
  const [previewLang, setPreviewLang] = useState<'kk' | 'ru'>('ru');
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const localeParams = useMemo(() => localeFilterParam(localeFilter), [localeFilter]);

  const { data: examTypes } = useQuery({
    queryKey: ['exam-types'],
    queryFn: async () => (await api.get('/exams/types')).data,
  });

  useEffect(() => {
    if (!examTypes || examTypes.length === 0 || examTypeId) return;
    if (searchParams.get('id')) return;
    const ent = examTypes.find((e: { slug: string }) => e.slug === 'ent');
    setExamTypeId((ent || examTypes[0]).id);
  }, [examTypes, examTypeId, searchParams]);

  useEffect(() => {
    const qid = searchParams.get('id');
    if (!qid) return;
    api.get('/admin/questions', { params: { id: qid, limit: 1 } }).then(({ data }) => {
      const item = data.items?.[0];
      if (item) {
        setExamTypeId(item.examTypeId);
        setSubjectId(item.subjectId);
        setPage(1);
      }
    });
  }, [searchParams]);

  const { data: subjects } = useQuery({
    queryKey: ['subjects', examTypeId],
    queryFn: async () => (await api.get(`/exams/types/${examTypeId}/subjects`)).data,
    enabled: !!examTypeId,
  });

  const subjectCountQueries = useQueries({
    queries: (subjects || []).map((s: { id: string }) => ({
      queryKey: ['admin-questions-count', examTypeId, s.id, localeFilter],
      queryFn: async () => {
        const { data } = await api.get('/admin/questions', {
          params: { examTypeId, subjectId: s.id, page: 1, limit: 1, ...localeParams },
        });
        return { subjectId: s.id, total: data.total as number };
      },
      enabled: !!examTypeId,
      staleTime: 30_000,
    })),
  });

  const subjectTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of subjectCountQueries) {
      const payload = q.data as { subjectId: string; total: number } | undefined;
      if (payload) map.set(payload.subjectId, payload.total);
    }
    return map;
  }, [subjectCountQueries]);

  const examTypeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const exam of examTypes || []) {
      map.set(exam.id, getLocalizedText((exam as { name: unknown }).name));
    }
    return map;
  }, [examTypes]);

  const subjectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const subj of subjects || []) {
      map.set(subj.id, getLocalizedText((subj as { name: unknown }).name));
    }
    return map;
  }, [subjects]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-questions', examTypeId, subjectId, page, localeFilter],
    queryFn: async () => {
      const { data: res } = await api.get('/admin/questions', {
        params: {
          examTypeId,
          subjectId,
          page,
          limit: 20,
          ...localeParams,
        },
      });
      return res;
    },
    enabled: !!examTypeId,
  });

  useEffect(() => {
    if (!modalOpen) return;
    form.setFieldsValue({
      examTypeId: examTypeId || undefined,
      subjectId: subjectId || undefined,
      contentLocale: 'ru',
      difficulty: 3,
      type: 'single_choice',
    });
  }, [modalOpen, examTypeId, subjectId, form]);

  const createQuestion = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const answers = values.answers as Array<{ ru?: string; kk?: string; en?: string; isCorrect?: boolean }>;
      const payload = {
        topicId: values.topicId || values.subjectId,
        subjectId: values.subjectId,
        examTypeId: values.examTypeId,
        difficulty: values.difficulty,
        type: values.type,
        contentLocale: values.contentLocale === 'kk' ? 'kk' : 'ru',
        content: {
          kk: { text: (values.content_kk as string) || '' },
          ru: { text: values.content_ru as string },
          en: { text: (values.content_en as string) || '' },
        },
        explanation: values.explanation_ru
          ? {
              kk: (values.explanation_kk as string) || '',
              ru: values.explanation_ru as string,
              en: (values.explanation_en as string) || '',
            }
          : undefined,
        answerOptions: answers.map((a, i) => ({
          content: { kk: a.kk || '', ru: a.ru || '', en: a.en || '' },
          isCorrect: a.isCorrect || false,
          sortOrder: i,
        })),
      };
      await api.post('/admin/questions', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-questions-count'] });
      setModalOpen(false);
      form.resetFields();
      message.success('Вопрос создан');
    },
    onError: () => message.error('Ошибка при создании'),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-questions-count'] });
      message.success('Вопрос удалён');
    },
  });

  const columns: ColumnsType<Question> = useMemo(
    () => [
      {
        title: (
          <Space size={8}>
            <span>Текст вопроса</span>
            <Tooltip title="Какой слот показывать в превью, если в записи оба языка">
              <Segmented
                size="small"
                value={previewLang}
                onChange={(v) => setPreviewLang(v as 'kk' | 'ru')}
                options={[
                  { label: 'KK', value: 'kk' },
                  { label: 'RU', value: 'ru' },
                ]}
              />
            </Tooltip>
          </Space>
        ),
        render: (_: unknown, record: Question) => {
          const text = getQuestionPreviewText(record, previewLang) || '—';
          const s = String(text);
          const short = s.length > 88 ? `${s.slice(0, 88)}…` : s;
          return (
            <Tooltip title={s.length > 88 ? s : undefined}>
              <span>{short}</span>
            </Tooltip>
          );
        },
      },
      {
        title: (
          <Space size={4}>
            <GlobalOutlined />
            Язык контента
          </Space>
        ),
        width: 130,
        render: (_: unknown, record: Question) => localeTag(getQuestionContentLocale(record.metadata)),
      },
      {
        title: 'Группа',
        width: 220,
        render: (_: unknown, record: Question) => {
          const examLabel =
            getLocalizedText(record.examType?.name) || examTypeNameMap.get(record.examTypeId) || '';
          const subjectLabel =
            getLocalizedText(record.subject?.name) || subjectNameMap.get(record.subjectId) || '';

          if (!examLabel && !subjectLabel) return '—';

          return (
            <Space size={4} wrap>
              {examLabel && <Tag color="blue">{examLabel}</Tag>}
              {subjectLabel && <Tag color="purple">{subjectLabel}</Tag>}
            </Space>
          );
        },
      },
      {
        title: 'Тип',
        dataIndex: 'type',
        width: 120,
        render: (v: string) => <Tag>{v}</Tag>,
      },
      {
        title: 'Сложность',
        dataIndex: 'difficulty',
        width: 100,
        render: (v: number) => '⭐'.repeat(v),
      },
      {
        title: 'Вариантов',
        render: (_: unknown, record: Question) => record.answerOptions?.length || 0,
        width: 90,
      },
      {
        title: 'Активен',
        dataIndex: 'isActive',
        width: 80,
        render: (v: boolean) =>
          v ? <Tag color="green">Да</Tag> : <Tag color="red">Нет</Tag>,
      },
      {
        title: 'Действия',
        width: 88,
        fixed: 'right',
        render: (_: unknown, record: Question) => (
          <Button
            type="text"
            icon={<DeleteOutlined />}
            danger
            onClick={() => {
              Modal.confirm({
                title: 'Удалить вопрос?',
                onOk: () => deleteQuestion.mutate(record.id),
              });
            }}
          />
        ),
      },
    ],
    [previewLang, examTypeNameMap, subjectNameMap],
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h2 className="admin-page-title">Вопросы</h2>
          <p className="admin-page-lead" style={{ marginBottom: 0 }}>
            Фильтр по языку контента использует поле <Typography.Text code>metadata.contentLocale</Typography.Text> — как
            в тестах (қазақша или русский). «Нет метки» — старые записи до миграции.
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Добавить вопрос
        </Button>
      </div>

      <Card size="small" styles={{ body: { padding: '16px 20px' } }} style={{ marginBottom: 16 }}>
        <Space wrap size={[12, 12]} align="center">
          <Select
            placeholder="Тип экзамена"
            allowClear
            style={{ width: 220 }}
            value={examTypeId}
            onChange={(value) => {
              setExamTypeId(value);
              setSubjectId(undefined);
              setPage(1);
            }}
            options={(examTypes || []).map((e: { id: string; name: unknown }) => ({
              value: e.id,
              label: getLocalizedText(e.name),
            }))}
          />
          {examTypeId && (
            <Select
              placeholder="Предмет"
              allowClear
              style={{ width: 220 }}
              value={subjectId}
              onChange={(value) => {
                setSubjectId(value);
                setPage(1);
              }}
              options={(subjects || []).map((s: { id: string; name: unknown }) => ({
                value: s.id,
                label: getLocalizedText(s.name),
              }))}
            />
          )}
          <Divider type="vertical" style={{ height: 28, margin: '0 4px' }} />
          <Typography.Text type="secondary" style={{ marginRight: 4 }}>
            Язык контента:
          </Typography.Text>
          <Segmented
            value={localeFilter || 'all'}
            onChange={(v) => {
              const val = v === 'all' ? '' : (v as LocaleFilter);
              setLocaleFilter(val);
              setPage(1);
            }}
            options={[
              { label: 'Все', value: 'all' },
              { label: 'Қазақша', value: 'kk' },
              { label: 'Русский', value: 'ru' },
              { label: 'Без метки', value: 'unset' },
            ]}
          />
        </Space>
      </Card>

      {!!examTypeId && (subjects?.length || 0) > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Быстрый выбор предмета
          </Typography.Text>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            <Button
              type={!subjectId ? 'primary' : 'default'}
              size="small"
              onClick={() => {
                setSubjectId(undefined);
                setPage(1);
              }}
            >
              Все ({data?.total ?? 0})
            </Button>
            {(subjects || []).map((s: { id: string; name: unknown }) => (
              <Button
                key={s.id}
                type={subjectId === s.id ? 'primary' : 'default'}
                size="small"
                onClick={() => {
                  setSubjectId(s.id);
                  setPage(1);
                }}
              >
                {getLocalizedText(s.name)} ({subjectTotals.get(s.id) ?? 0})
              </Button>
            ))}
          </div>
        </div>
      )}

      <Table<Question>
        columns={columns}
        dataSource={examTypeId ? data?.items || [] : []}
        rowKey="id"
        rowClassName={(record) => (highlightId && record.id === highlightId ? 'admin-row-highlight' : '')}
        loading={isLoading}
        pagination={{
          current: page,
          total: data?.total || 0,
          pageSize: 20,
          onChange: setPage,
          showTotal: (total) => `Всего: ${total}`,
          showSizeChanger: false,
        }}
        size="middle"
        scroll={{ x: 1100 }}
        locale={{
          emptyText: examTypeId ? (
            <Empty description="По выбранным фильтрам вопросов нет" />
          ) : (
            <Empty description="Сначала выберите тип экзамена" />
          ),
        }}
      />

      <Modal
        title="Новый вопрос"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createQuestion.isPending}
        width={820}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => createQuestion.mutate(v)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Form.Item name="examTypeId" label="Тип экзамена" rules={[{ required: true }]}>
              <Select
                options={(examTypes || []).map((e: { id: string; name: unknown }) => ({
                  value: e.id,
                  label: getLocalizedText(e.name),
                }))}
              />
            </Form.Item>
            <Form.Item name="subjectId" label="Предмет" rules={[{ required: true }]}>
              <Select
                options={(subjects || []).map((s: { id: string; name: unknown }) => ({
                  value: s.id,
                  label: getLocalizedText(s.name),
                }))}
              />
            </Form.Item>
            <Form.Item
              name="contentLocale"
              label="Язык контента в тестах"
              rules={[{ required: true }]}
              initialValue="ru"
              tooltip="Определяет, в каком пуле вопрос окажется при сдаче на KK или RU"
            >
              <Select
                options={[
                  { value: 'ru', label: 'Русский (RU)' },
                  { value: 'kk', label: 'Қазақша (KK)' },
                ]}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="difficulty" label="Сложность" rules={[{ required: true }]} initialValue={3}>
              <InputNumber min={1} max={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="type" label="Тип вопроса" rules={[{ required: true }]} initialValue="single_choice">
              <Select
                options={[
                  { value: 'single_choice', label: 'Один ответ' },
                  { value: 'multiple_choice', label: 'Несколько ответов' },
                ]}
              />
            </Form.Item>
          </div>

          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
            Поле topicId в API подставляется из предмета, если тема не задана. Для отдельной темы используйте bulk-import
            или правку в БД.
          </Typography.Paragraph>

          <Form.Item name="content_ru" label="Текст вопроса (RU)" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Используйте $...$ для формул LaTeX" />
          </Form.Item>
          <Form.Item name="content_kk" label="Текст вопроса (KK)">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="content_en" label="Текст вопроса (EN)">
            <TextArea rows={2} />
          </Form.Item>

          <Form.Item name="explanation_ru" label="Объяснение (RU) — Premium">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="explanation_kk" label="Объяснение (KK)">
            <TextArea rows={2} />
          </Form.Item>

          <Typography.Title level={5} style={{ marginTop: 8 }}>
            Варианты ответов
          </Typography.Title>
          <Form.List name="answers" initialValue={[{}, {}, {}, {}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <div
                    key={field.key}
                    style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}
                  >
                    <span style={{ marginTop: 8, fontWeight: 600, width: 22 }}>
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <Form.Item
                      name={[field.name, 'ru']}
                      style={{ flex: 1, marginBottom: 0 }}
                      rules={[{ required: true, message: 'Обязательно' }]}
                    >
                      <Input placeholder={`Вариант ${index + 1} (RU)`} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'kk']} style={{ flex: 1, marginBottom: 0 }}>
                      <Input placeholder="KK" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'isCorrect']} valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Switch checkedChildren="✓" unCheckedChildren="✗" />
                    </Form.Item>
                    {fields.length > 2 && (
                      <Button type="text" danger onClick={() => remove(field.name)}>
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block>
                  + Добавить вариант
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
