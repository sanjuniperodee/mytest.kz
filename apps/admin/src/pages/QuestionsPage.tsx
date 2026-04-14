import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import {
  Table,
  Button,
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
  Tabs,
  Typography,
  Tooltip,
  Drawer,
  Alert,
  Divider,
  Modal,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, GlobalOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import {
  getLocalizedText,
  getQuestionContentLocale,
  getQuestionPreviewText,
  pickContentLang,
  localeFilterParam,
  localeFilterToTabKey,
  tabKeyToLocaleFilter,
  LOCALE_TAB_KEYS,
  parseQuestionFormSlots,
  buildQuestionContentJson,
  buildSimilarityNeedle,
  type AdminLocaleFilter,
} from '../lib/questionContent';

const { TextArea } = Input;

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

function explanationFromRecord(exp: unknown): {
  explanation_ru: string;
  explanation_kk: string;
  explanation_en: string;
} {
  if (!exp || typeof exp !== 'object') {
    return { explanation_ru: '', explanation_kk: '', explanation_en: '' };
  }
  const o = exp as Record<string, unknown>;
  return {
    explanation_ru: typeof o.ru === 'string' ? o.ru : '',
    explanation_kk: typeof o.kk === 'string' ? o.kk : '',
    explanation_en: typeof o.en === 'string' ? o.en : '',
  };
}

function answersToFormList(q: Question) {
  return (q.answerOptions || []).map((opt) => ({
    ru: pickContentLang(opt.content, 'ru'),
    kk: pickContentLang(opt.content, 'kk'),
    en: pickContentLang(opt.content, 'en'),
    isCorrect: opt.isCorrect,
  }));
}

export function QuestionsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('id');
  const [page, setPage] = useState(1);
  const [examTypeId, setExamTypeId] = useState<string | undefined>();
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [localeFilter, setLocaleFilter] = useState<AdminLocaleFilter>('');
  const [previewLang, setPreviewLang] = useState<'kk' | 'ru'>('ru');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const localeParams = useMemo(() => localeFilterParam(localeFilter), [localeFilter]);

  const stemRu = Form.useWatch('stem_ru', form);
  const topicRu = Form.useWatch('topic_ru', form);
  const stemKk = Form.useWatch('stem_kk', form);
  const topicKk = Form.useWatch('topic_kk', form);
  const contentLocaleWatch = Form.useWatch('contentLocale', form);
  const formSubjectId = Form.useWatch('subjectId', form);
  const formExamTypeId = Form.useWatch('examTypeId', form);

  const similaritySource = useMemo(() => {
    const loc = contentLocaleWatch === 'kk' ? 'kk' : 'ru';
    return buildSimilarityNeedle(
      {
        topic_ru: topicRu || '',
        stem_ru: stemRu || '',
        topic_kk: topicKk || '',
        stem_kk: stemKk || '',
      },
      loc,
    );
  }, [contentLocaleWatch, topicRu, stemRu, topicKk, stemKk]);

  const debouncedSimilaritySource = useDebouncedValue(similaritySource, 480);

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

  const { data: editingQuestion, isLoading: editingLoading } = useQuery({
    queryKey: ['admin-question-one', editingId],
    queryFn: async () => {
      const { data } = await api.get('/admin/questions', { params: { id: editingId, limit: 1 } });
      return data.items?.[0] as Question | undefined;
    },
    enabled: drawerOpen && editorMode === 'edit' && !!editingId,
  });

  useEffect(() => {
    if (!drawerOpen || editorMode !== 'edit' || !editingQuestion) return;
    const exp = explanationFromRecord(editingQuestion.explanation);
    const meta = editingQuestion.metadata as { contentLocale?: string } | undefined;
    form.setFieldsValue({
      examTypeId: editingQuestion.examTypeId,
      subjectId: editingQuestion.subjectId,
      contentLocale: meta?.contentLocale === 'kk' ? 'kk' : 'ru',
      difficulty: editingQuestion.difficulty,
      type: editingQuestion.type,
      ...parseQuestionFormSlots(editingQuestion.content),
      ...exp,
      answers: answersToFormList(editingQuestion),
    });
  }, [drawerOpen, editorMode, editingQuestion, form]);

  const similarLocale = contentLocaleWatch === 'kk' ? 'kk' : 'ru';
  const { data: similarData } = useQuery({
    queryKey: [
      'admin-questions-similar',
      formExamTypeId,
      formSubjectId,
      similarLocale,
      debouncedSimilaritySource,
      editingId,
    ],
    queryFn: async () => {
      const { data } = await api.get<{ items: { id: string; score: number; preview: string }[] }>(
        '/admin/questions/similar',
        {
          params: {
            examTypeId: formExamTypeId,
            subjectId: formSubjectId,
            locale: similarLocale,
            text: debouncedSimilaritySource,
            excludeId: editingId || undefined,
            threshold: 0.38,
            limit: 14,
          },
        },
      );
      return data;
    },
    enabled:
      drawerOpen &&
      !!formExamTypeId &&
      !!formSubjectId &&
      debouncedSimilaritySource.trim().length >= 10,
  });

  const openCreate = () => {
    setEditorMode('create');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      examTypeId: examTypeId || undefined,
      subjectId: subjectId || undefined,
      contentLocale: 'ru',
      difficulty: 3,
      type: 'single_choice',
      topic_ru: '',
      stem_ru: '',
      topic_kk: '',
      stem_kk: '',
      topic_en: '',
      stem_en: '',
      answers: [{}, {}, {}, {}],
    });
    setDrawerOpen(true);
  };

  const openEdit = (record: Question) => {
    setEditorMode('edit');
    setEditingId(record.id);
    form.resetFields();
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
    form.resetFields();
  };

  const buildPayload = (values: Record<string, unknown>) => {
    const answers = values.answers as Array<{ ru?: string; kk?: string; en?: string; isCorrect?: boolean }>;
    const content = buildQuestionContentJson({
      topic_ru: (values.topic_ru as string) || '',
      stem_ru: (values.stem_ru as string) || '',
      topic_kk: (values.topic_kk as string) || '',
      stem_kk: (values.stem_kk as string) || '',
      topic_en: (values.topic_en as string) || '',
      stem_en: (values.stem_en as string) || '',
    });
    return {
      topicId: (values.topicId as string) || (values.subjectId as string),
      subjectId: values.subjectId as string,
      examTypeId: values.examTypeId as string,
      difficulty: values.difficulty as number,
      type: values.type as string,
      contentLocale: values.contentLocale === 'kk' ? 'kk' : 'ru',
      content,
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
  };

  const saveQuestion = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = buildPayload(values);
      if (editorMode === 'edit' && editingId) {
        await api.patch(`/admin/questions/${editingId}`, payload);
        return;
      }
      await api.post('/admin/questions', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-questions-count'] });
      queryClient.invalidateQueries({ queryKey: ['admin-question-one'] });
      closeDrawer();
      message.success(editorMode === 'edit' ? 'Вопрос сохранён' : 'Вопрос создан');
    },
    onError: () => message.error('Ошибка сохранения'),
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

  const similarItems = similarData?.items || [];
  const strongDup = similarItems.filter((x) => x.score >= 0.85);
  const mediumSim = similarItems.filter((x) => x.score >= 0.72 && x.score < 0.85);

  const columns: ColumnsType<Question> = useMemo(
    () => [
      {
        title: (
          <Space size={8}>
            <span>Текст вопроса</span>
            <Tooltip title="Превью: заголовок + условие (если заданы отдельно)">
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
        width: 120,
        fixed: 'right',
        render: (_: unknown, record: Question) => (
          <Space size={0}>
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} aria-label="Изменить" />
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
          </Space>
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
            Заголовок (тема блока) и условие хранятся отдельно в JSON{' '}
            <Typography.Text code>topicLine</Typography.Text> + <Typography.Text code>text</Typography.Text> — в
            тесте как раньше склеивается для подписи к условию. При вводе условия показываются похожие вопросы того же
            предмета (оценка по словам и биграммам; ≥0,85 — вероятный дубликат).
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Добавить вопрос
        </Button>
      </div>

      <Tabs
        activeKey={localeFilterToTabKey(localeFilter)}
        onChange={(key) => {
          setLocaleFilter(tabKeyToLocaleFilter(key));
          setPage(1);
          if (key === LOCALE_TAB_KEYS.kk) setPreviewLang('kk');
          if (key === LOCALE_TAB_KEYS.ru) setPreviewLang('ru');
        }}
        type="line"
        size="large"
        style={{ marginBottom: 16 }}
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

      <Drawer
        title={editorMode === 'edit' ? 'Редактирование вопроса' : 'Новый вопрос'}
        width={920}
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeDrawer}>Отмена</Button>
            <Button type="primary" loading={saveQuestion.isPending} onClick={() => form.submit()}>
              Сохранить
            </Button>
          </Space>
        }
      >
        {editorMode === 'edit' && editingLoading && (
          <Typography.Paragraph>Загрузка…</Typography.Paragraph>
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => saveQuestion.mutate(v)}
          style={{ maxWidth: 880 }}
        >
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
              tooltip="Пул KK/RU при сборке сессии"
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

          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            Поле <Typography.Text code>topicId</Typography.Text> в API = предмет, если тема не задана отдельно.
          </Typography.Paragraph>

          <Divider orientation="left">Русский</Divider>
          <Form.Item
            name="topic_ru"
            label="Текст вопроса / подпись блока (RU)"
            tooltip="Короткая строка: раздел, контекст ЕНТ. Не путать с условием ниже."
          >
            <Input placeholder="Например: Раздел «Алгебра»" />
          </Form.Item>
          <Form.Item name="stem_ru" label="Условие / формулировка (RU)" rules={[{ required: true }]}>
            <TextArea rows={5} placeholder="Основной текст задания. LaTeX: $...$" />
          </Form.Item>

          <Divider orientation="left">Қазақша</Divider>
          <Form.Item name="topic_kk" label="Текст вопроса / подпись (KK)">
            <Input placeholder="Бөлім атауы" />
          </Form.Item>
          <Form.Item name="stem_kk" label="Условие (KK)">
            <TextArea rows={4} />
          </Form.Item>

          <Divider orientation="left">English (опционально)</Divider>
          <Form.Item name="topic_en" label="Topic line (EN)">
            <Input />
          </Form.Item>
          <Form.Item name="stem_en" label="Stem (EN)">
            <TextArea rows={2} />
          </Form.Item>

          {drawerOpen && !!formSubjectId && (
            <>
              {strongDup.length > 0 && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Высокое сходство (≥85%) — проверьте дубликат"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {strongDup.map((row) => (
                        <li key={row.id}>
                          <Typography.Text strong>{Math.round(row.score * 100)}%</Typography.Text>{' '}
                          <Link to={`/questions?id=${row.id}`} onClick={() => closeDrawer()}>
                            {row.preview}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  }
                />
              )}
              {mediumSim.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Похожие вопросы (72–85%)"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {mediumSim.map((row) => (
                        <li key={row.id}>
                          <Typography.Text>{Math.round(row.score * 100)}%</Typography.Text>{' '}
                          <Link to={`/questions?id=${row.id}`}>{row.preview}</Link>
                        </li>
                      ))}
                    </ul>
                  }
                />
              )}
              {similarItems.length > 0 && strongDup.length === 0 && mediumSim.length === 0 && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Возможные совпадения"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {similarItems.slice(0, 8).map((row) => (
                        <li key={row.id}>
                          {Math.round(row.score * 100)}%{' '}
                          <Link to={`/questions?id=${row.id}`}>{row.preview}</Link>
                        </li>
                      ))}
                    </ul>
                  }
                />
              )}
            </>
          )}

          <Divider orientation="left">Объяснение (Premium)</Divider>
          <Form.Item name="explanation_ru" label="Объяснение (RU)">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="explanation_kk" label="Объяснение (KK)">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="explanation_en" label="Объяснение (EN)">
            <TextArea rows={2} />
          </Form.Item>

          <Typography.Title level={5}>Варианты ответов</Typography.Title>
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
      </Drawer>
    </div>
  );
}
