import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Switch, Space, Tag, message, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';

const { TextArea } = Input;

interface Question {
  id: string;
  examTypeId: string;
  subjectId: string;
  topicId: string;
  difficulty: number;
  type: string;
  content: any;
  explanation: any;
  isActive: boolean;
  answerOptions: { id: string; content: any; isCorrect: boolean; sortOrder: number }[];
  subject?: { id: string; name: string; slug: string };
  examType?: { id: string; name: string; slug: string };
  topic?: { id: string; name: string };
}

function getLocalizedText(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // localized JSON: { ru: "..."} or { ru: { text: "..." } }
    const candidates = ['ru', 'kk', 'en'];
    for (const lang of candidates) {
      const v = value?.[lang];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'object' && typeof v?.text === 'string' && v.text.trim()) return v.text;
    }
    // plain object with text
    if (typeof value?.text === 'string' && value.text.trim()) return value.text;
  }
  return '';
}

export function QuestionsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('id');
  const [page, setPage] = useState(1);
  const [examTypeId, setExamTypeId] = useState<string | undefined>();
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: examTypes } = useQuery({
    queryKey: ['exam-types'],
    queryFn: async () => (await api.get('/exams/types')).data,
  });

  useEffect(() => {
    if (!examTypes || examTypes.length === 0 || examTypeId) return;
    if (searchParams.get('id')) return;
    const ent = examTypes.find((e: any) => e.slug === 'ent');
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
    queries: (subjects || []).map((s: any) => ({
      queryKey: ['admin-questions-count', examTypeId, s.id],
      queryFn: async () => {
        const { data } = await api.get('/admin/questions', {
          params: { examTypeId, subjectId: s.id, page: 1, limit: 1 },
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
      map.set(exam.id, getLocalizedText(exam.name));
    }
    return map;
  }, [examTypes]);

  const subjectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const subj of subjects || []) {
      map.set(subj.id, getLocalizedText(subj.name));
    }
    return map;
  }, [subjects]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-questions', examTypeId, subjectId, page],
    queryFn: async () => {
      const { data } = await api.get('/admin/questions', {
        params: { examTypeId, subjectId, page, limit: 20 },
      });
      return data;
    },
    enabled: !!examTypeId,
  });

  const createQuestion = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        topicId: values.topicId || values.subjectId, // fallback if no topic
        subjectId: values.subjectId,
        examTypeId: values.examTypeId,
        difficulty: values.difficulty,
        type: values.type,
        content: {
          kk: { text: values.content_kk || '' },
          ru: { text: values.content_ru },
          en: { text: values.content_en || '' },
        },
        explanation: values.explanation_ru ? {
          kk: values.explanation_kk || '',
          ru: values.explanation_ru,
          en: values.explanation_en || '',
        } : undefined,
        answerOptions: values.answers.map((a: any, i: number) => ({
          content: { kk: a.kk || '', ru: a.ru, en: a.en || '' },
          isCorrect: a.isCorrect || false,
          sortOrder: i,
        })),
      };
      await api.post('/admin/questions', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
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
      message.success('Вопрос удалён');
    },
  });

  const columns: ColumnsType<Question> = [
    {
      title: 'Вопрос (RU)',
      render: (_: unknown, record: Question) => {
        const text = getLocalizedText(record.content) || '—';
        return <span>{String(text).slice(0, 80)}{String(text).length > 80 ? '...' : ''}</span>;
      },
    },
    {
      title: 'Группа',
      width: 220,
      render: (_: unknown, record: Question) => {
        const examLabel = getLocalizedText(record.examType?.name) || examTypeNameMap.get(record.examTypeId) || '';
        const subjectLabel = getLocalizedText(record.subject?.name) || subjectNameMap.get(record.subjectId) || '';

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
      width: 100,
    },
    {
      title: 'Активен',
      dataIndex: 'isActive',
      width: 80,
      render: (v: boolean) => v ? <Tag color="green">Да</Tag> : <Tag color="red">Нет</Tag>,
    },
    {
      title: 'Действия',
      width: 100,
      render: (_: unknown, record: Question) => (
        <Space>
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
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Вопросы</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Добавить вопрос
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Тип экзамена"
          allowClear
          style={{ width: 200 }}
          value={examTypeId}
          onChange={(value) => {
            setExamTypeId(value);
            setSubjectId(undefined);
            setPage(1);
          }}
          options={examTypes?.map((e: any) => ({ value: e.id, label: e.name }))}
        />
        {examTypeId && (
          <Select
            placeholder="Предмет"
            allowClear
            style={{ width: 200 }}
            value={subjectId}
            onChange={(value) => {
              setSubjectId(value);
              setPage(1);
            }}
            options={subjects?.map((s: any) => ({ value: s.id, label: s.name }))}
          />
        )}
      </Space>

      {!!examTypeId && (subjects?.length || 0) > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
            Подгруппы внутри выбранного экзамена
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            <Button
              type={!subjectId ? 'primary' : 'default'}
              size="small"
              onClick={() => {
                setSubjectId(undefined);
                setPage(1);
              }}
            >
              Все ({data?.total || 0})
            </Button>
            {(subjects || []).map((s: any) => (
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

      <Table
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
        }}
        size="middle"
        locale={{
          emptyText: examTypeId
            ? <Empty description="По выбранным фильтрам вопросов нет" />
            : <Empty description="Сначала выберите тип экзамена" />,
        }}
      />

      {/* Create question modal */}
      <Modal
        title="Новый вопрос"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createQuestion.isPending}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createQuestion.mutate(v)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="examTypeId" label="Тип экзамена" rules={[{ required: true }]}>
              <Select options={examTypes?.map((e: any) => ({ value: e.id, label: e.name }))} />
            </Form.Item>
            <Form.Item name="subjectId" label="Предмет" rules={[{ required: true }]}>
              <Select options={subjects?.map((s: any) => ({ value: s.id, label: s.name }))} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="difficulty" label="Сложность" rules={[{ required: true }]} initialValue={3}>
              <InputNumber min={1} max={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="type" label="Тип вопроса" rules={[{ required: true }]} initialValue="single_choice">
              <Select options={[
                { value: 'single_choice', label: 'Один ответ' },
                { value: 'multiple_choice', label: 'Несколько ответов' },
              ]} />
            </Form.Item>
          </div>

          <Form.Item name="content_ru" label="Текст вопроса (RU)" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Используйте $...$ для формул LaTeX" />
          </Form.Item>
          <Form.Item name="content_kk" label="Текст вопроса (KK)">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="content_en" label="Текст вопроса (EN)">
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item name="explanation_ru" label="Объяснение (RU) — Premium">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="explanation_kk" label="Объяснение (KK)">
            <TextArea rows={2} />
          </Form.Item>

          <h4>Варианты ответов</h4>
          <Form.List name="answers" initialValue={[{}, {}, {}, {}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <div key={field.key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                    <span style={{ marginTop: 8, fontWeight: 600 }}>{String.fromCharCode(65 + index)}.</span>
                    <Form.Item name={[field.name, 'ru']} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: 'Обязательно' }]}>
                      <Input placeholder={`Вариант ${index + 1} (RU)`} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'kk']} style={{ flex: 1, marginBottom: 0 }}>
                      <Input placeholder="KK" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'isCorrect']} valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Switch checkedChildren="✓" unCheckedChildren="✗" />
                    </Form.Item>
                    {fields.length > 2 && (
                      <Button type="text" danger onClick={() => remove(field.name)}>✕</Button>
                    )}
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block>+ Добавить вариант</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
