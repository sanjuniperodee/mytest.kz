import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { getLocalizedText, pickContentLang, splitLocalizedSlot } from '../lib/questionContent';

type CatalogListLang = 'ru' | 'kk' | 'en';

function listLabel(value: unknown, lang: CatalogListLang): string {
  return pickContentLang(value, lang) || getLocalizedText(value);
}

type TopicRow = { id: string; name: unknown; sortOrder: number };
type SubjectRow = {
  id: string;
  slug: string;
  name: unknown;
  isMandatory: boolean;
  sortOrder: number;
  topics: TopicRow[];
};
type ExamRow = {
  id: string;
  slug: string;
  name: unknown;
  description?: unknown | null;
  isActive: boolean;
  subjects: SubjectRow[];
  _count?: { questions: number; testTemplates: number };
};

type TemplateRow = {
  id: string;
  name: unknown;
  durationMins: number;
  isActive: boolean;
  sections: {
    id: string;
    subjectId: string;
    questionCount: number;
    selectionMode: string;
    sortOrder: number;
    profileHeavyFrom?: number | null;
    subject?: { id: string; slug: string; name: unknown };
  }[];
};

export function ExamCatalogPage() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(true);
  const [catalogListLang, setCatalogListLang] = useState<CatalogListLang>('ru');
  const [examDrawer, setExamDrawer] = useState<{ open: boolean; mode: 'create' | 'edit'; exam?: ExamRow }>({
    open: false,
    mode: 'create',
  });
  const [subjectDrawer, setSubjectDrawer] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    examId?: string;
    subject?: SubjectRow;
  }>({ open: false, mode: 'create' });
  const [topicModal, setTopicModal] = useState<{ open: boolean; subject?: SubjectRow }>({ open: false });
  const [topicFormOpen, setTopicFormOpen] = useState<{ mode: 'create' | 'edit'; topic?: TopicRow } | null>(null);
  const [templateDrawer, setTemplateDrawer] = useState<{ open: boolean; exam?: ExamRow }>({ open: false });
  const [tplEditor, setTplEditor] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    examId?: string;
    template?: TemplateRow;
  }>({ open: false, mode: 'create' });

  const [examForm] = Form.useForm();
  const [subjectForm] = Form.useForm();
  const [topicForm] = Form.useForm();
  const [templateForm] = Form.useForm();

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['admin-exams-catalog', includeInactive],
    queryFn: async () => {
      const { data } = await api.get<ExamRow[]>('/admin/exams/catalog', {
        params: { includeInactive: includeInactive ? 'true' : 'false' },
      });
      return data;
    },
  });

  const { data: templates, isLoading: tplLoading } = useQuery({
    queryKey: ['admin-exam-templates', templateDrawer.exam?.id, includeInactive],
    queryFn: async () => {
      const { data } = await api.get<TemplateRow[]>(
        `/admin/exams/types/${templateDrawer.exam!.id}/templates`,
        { params: { includeInactive: 'true' } },
      );
      return data;
    },
    enabled: templateDrawer.open && !!templateDrawer.exam?.id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-exams-catalog'] });
    queryClient.invalidateQueries({ queryKey: ['admin-exam-templates'] });
    /** Совпадает с apps/web (useExamTypes, useSubjects, useTemplates) */
    queryClient.invalidateQueries({ queryKey: ['examTypes'] });
    queryClient.invalidateQueries({ queryKey: ['subjects'] });
    queryClient.invalidateQueries({ queryKey: ['templates'] });
    queryClient.invalidateQueries({ queryKey: ['mistakes-summary'] });
  };

  const createExam = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      await api.post('/admin/exams/types', {
        slug: v.slug,
        name: { ru: v.name_ru, kk: v.name_kk || '', en: v.name_en || '' },
        description:
          v.desc_ru || v.desc_kk || v.desc_en
            ? { ru: v.desc_ru || '', kk: v.desc_kk || '', en: v.desc_en || '' }
            : undefined,
        isActive: v.isActive !== false,
      });
    },
    onSuccess: () => {
      invalidate();
      message.success('Экзамен создан');
      setExamDrawer({ open: false, mode: 'create' });
      examForm.resetFields();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Ошибка');
    },
  });

  const updateExam = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: Record<string, unknown> }) => {
      await api.patch(`/admin/exams/types/${id}`, {
        name: { ru: v.name_ru, kk: v.name_kk || '', en: v.name_en || '' },
        description:
          v.desc_ru || v.desc_kk || v.desc_en
            ? { ru: v.desc_ru || '', kk: v.desc_kk || '', en: v.desc_en || '' }
            : undefined,
        isActive: v.isActive,
      });
    },
    onSuccess: () => {
      invalidate();
      message.success('Сохранено');
      setExamDrawer({ open: false, mode: 'create' });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Ошибка');
    },
  });

  const deactivateExam = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/exams/types/${id}`),
    onSuccess: () => {
      invalidate();
      message.success('Экзамен скрыт');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Ошибка');
    },
  });

  const createSubject = useMutation({
    mutationFn: async ({ examId, v }: { examId: string; v: Record<string, unknown> }) => {
      await api.post(`/admin/exams/types/${examId}/subjects`, {
        slug: v.slug,
        name: { ru: v.name_ru, kk: v.name_kk || '', en: v.name_en || '' },
        isMandatory: !!v.isMandatory,
        sortOrder: v.sortOrder ?? 0,
      });
    },
    onSuccess: () => {
      invalidate();
      message.success('Предмет добавлен');
      setSubjectDrawer({ open: false, mode: 'create' });
      subjectForm.resetFields();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Ошибка');
    },
  });

  const updateSubject = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: Record<string, unknown> }) => {
      await api.patch(`/admin/exams/subjects/${id}`, {
        slug: v.slug,
        name: { ru: v.name_ru, kk: v.name_kk || '', en: v.name_en || '' },
        isMandatory: !!v.isMandatory,
        sortOrder: v.sortOrder ?? 0,
      });
    },
    onSuccess: () => {
      invalidate();
      message.success('Предмет сохранён');
      setSubjectDrawer({ open: false, mode: 'create' });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Ошибка');
    },
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/exams/subjects/${id}`),
    onSuccess: () => {
      invalidate();
      message.success('Предмет удалён');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Ошибка');
    },
  });

  const createTopic = useMutation({
    mutationFn: async ({ subjectId, v }: { subjectId: string; v: Record<string, unknown> }) => {
      await api.post(`/admin/exams/subjects/${subjectId}/topics`, {
        name: { ru: v.name_ru, kk: v.name_kk || '', en: v.name_en || '' },
        sortOrder: v.sortOrder,
      });
    },
    onSuccess: () => {
      invalidate();
      message.success('Тема добавлена');
      setTopicFormOpen(null);
      topicForm.resetFields();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Ошибка');
    },
  });

  const updateTopic = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: Record<string, unknown> }) => {
      await api.patch(`/admin/exams/topics/${id}`, {
        name: { ru: v.name_ru, kk: v.name_kk || '', en: v.name_en || '' },
        sortOrder: v.sortOrder,
      });
    },
    onSuccess: () => {
      invalidate();
      message.success('Тема сохранена');
      setTopicFormOpen(null);
    },
    onError: () => message.error('Ошибка'),
  });

  const deleteTopic = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/exams/topics/${id}`),
    onSuccess: () => {
      invalidate();
      message.success('Тема удалена');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Ошибка');
    },
  });

  const saveTemplate = useMutation({
    mutationFn: async (payload: {
      mode: 'create' | 'edit';
      examId?: string;
      templateId?: string;
      values: Record<string, unknown>;
    }) => {
      const sections = (payload.values.sections as Array<{
        subjectId: string;
        questionCount: number;
        selectionMode?: string;
        profileHeavyFrom?: number | null;
      }>) || [];
      const body = {
        name: {
          ru: payload.values.name_ru,
          kk: payload.values.name_kk || '',
          en: payload.values.name_en || '',
        },
        durationMins: payload.values.durationMins,
        isActive: payload.values.isActive !== false,
        sections: sections.map((s, i) => ({
          subjectId: s.subjectId,
          questionCount: Number(s.questionCount),
          selectionMode: s.selectionMode || 'random',
          sortOrder: i,
          profileHeavyFrom:
            s.profileHeavyFrom === undefined ||
            s.profileHeavyFrom === null ||
            (typeof s.profileHeavyFrom === 'number' && Number.isNaN(s.profileHeavyFrom))
              ? null
              : Math.max(1, Math.min(500, Math.floor(Number(s.profileHeavyFrom)))),
        })),
      };
      if (payload.mode === 'create' && payload.examId) {
        await api.post(`/admin/exams/types/${payload.examId}/templates`, body);
        return;
      }
      if (payload.mode === 'edit' && payload.templateId) {
        await api.patch(`/admin/exams/templates/${payload.templateId}`, {
          name: body.name,
          durationMins: body.durationMins,
          isActive: body.isActive,
        });
        await api.put(`/admin/exams/templates/${payload.templateId}/sections`, {
          sections: body.sections,
        });
      }
    },
    onSuccess: () => {
      invalidate();
      message.success('Шаблон сохранён');
      setTplEditor({ open: false, mode: 'create' });
      templateForm.resetFields();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Ошибка');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/exams/templates/${id}`),
    onSuccess: () => {
      invalidate();
      message.success('Шаблон удалён');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Ошибка');
    },
  });

  const collapseItems = (catalog || []).map((exam) => {
    const subjectColumns: ColumnsType<SubjectRow> = [
      { title: 'Slug', dataIndex: 'slug', width: 140 },
      { title: 'Название', render: (_, r) => listLabel(r.name, catalogListLang) },
      {
        title: 'Обяз.',
        dataIndex: 'isMandatory',
        width: 80,
        render: (v: boolean) => (v ? <Tag color="blue">Да</Tag> : '—'),
      },
      { title: 'Порядок', dataIndex: 'sortOrder', width: 90 },
      {
        title: '',
        width: 220,
        render: (_, r) => (
          <Space size={0} wrap>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setSubjectDrawer({ open: true, mode: 'edit', examId: exam.id, subject: r });
                const subName = splitLocalizedSlot(r.name);
                subjectForm.setFieldsValue({
                  slug: r.slug,
                  name_ru: subName.ru,
                  name_kk: subName.kk,
                  name_en: subName.en,
                  isMandatory: r.isMandatory,
                  sortOrder: r.sortOrder,
                });
              }}
            >
              Изменить
            </Button>
            <Button type="link" size="small" onClick={() => setTopicModal({ open: true, subject: r })}>
              Темы
            </Button>
            <Button
              type="link"
              size="small"
              danger
              onClick={() => {
                Modal.confirm({
                  title: 'Удалить предмет?',
                  content: 'Только если нет вопросов по этому предмету.',
                  onOk: () => deleteSubject.mutate(r.id),
                });
              }}
            >
              Удалить
            </Button>
          </Space>
        ),
      },
    ];
    return {
      key: exam.id,
      label: (
        <Space wrap>
          <Typography.Text strong>{listLabel(exam.name, catalogListLang)}</Typography.Text>
          <Typography.Text type="secondary">({exam.slug})</Typography.Text>
          {!exam.isActive && <Tag>скрыт</Tag>}
          {exam._count && (
            <Tag color="default">
              вопр. {exam._count.questions} · шабл. {exam._count.testTemplates}
            </Tag>
          )}
        </Space>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="ID">{exam.id}</Descriptions.Item>
          </Descriptions>
          <Space wrap>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setExamDrawer({ open: true, mode: 'edit', exam });
                const exName = splitLocalizedSlot(exam.name);
                const exDesc = splitLocalizedSlot(exam.description);
                examForm.setFieldsValue({
                  slug: exam.slug,
                  name_ru: exName.ru,
                  name_kk: exName.kk,
                  name_en: exName.en,
                  desc_ru: exDesc.ru,
                  desc_kk: exDesc.kk,
                  desc_en: exDesc.en,
                  isActive: exam.isActive,
                });
              }}
            >
              Редактировать экзамен
            </Button>
            <Button icon={<FileTextOutlined />} onClick={() => setTemplateDrawer({ open: true, exam })}>
              Шаблоны тестов
            </Button>
            {exam.isActive && (
              <Button
                danger
                onClick={() => {
                  Modal.confirm({
                    title: 'Скрыть экзамен?',
                    onOk: () => deactivateExam.mutate(exam.id),
                  });
                }}
              >
                Скрыть
              </Button>
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setSubjectDrawer({ open: true, mode: 'create', examId: exam.id });
                subjectForm.resetFields();
                subjectForm.setFieldsValue({ isMandatory: false, sortOrder: 0 });
              }}
            >
              Предмет
            </Button>
          </Space>
          <Table<SubjectRow>
            size="small"
            rowKey="id"
            dataSource={exam.subjects}
            columns={subjectColumns}
            pagination={false}
          />
        </Space>
      ),
    };
  });

  return (
    <AdminPageShell>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
        Не меняйте slug экзамена без причины. Сущности с вопросами не удаляются.
      </Typography.Text>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="center">
          <Space>
            <span>Показать скрытые экзамены</span>
            <Switch checked={includeInactive} onChange={setIncludeInactive} />
          </Space>
          <Space direction="vertical" size={4}>
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>Превью названий в списках</span>
            <Segmented<CatalogListLang>
              size="small"
              value={catalogListLang}
              onChange={setCatalogListLang}
              options={[
                { label: 'RU', value: 'ru' },
                { label: 'KK', value: 'kk' },
                { label: 'EN', value: 'en' },
              ]}
            />
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setExamDrawer({ open: true, mode: 'create' });
              examForm.resetFields();
              examForm.setFieldsValue({ isActive: true });
            }}
          >
            Новый экзамен
          </Button>
        </Space>
      </Card>

      <Spin spinning={isLoading}>
        <Collapse items={collapseItems} defaultActiveKey={catalog?.[0]?.id} />
      </Spin>

      <Drawer
        title={examDrawer.mode === 'create' ? 'Новый экзамен' : 'Редактировать экзамен'}
        width={480}
        open={examDrawer.open}
        onClose={() => setExamDrawer({ open: false, mode: 'create' })}
        destroyOnClose
        extra={
          <Button
            type="primary"
            loading={createExam.isPending || updateExam.isPending}
            onClick={() => examForm.submit()}
          >
            Сохранить
          </Button>
        }
      >
        <Form
          form={examForm}
          layout="vertical"
          onFinish={(v) => {
            if (examDrawer.mode === 'create') createExam.mutate(v);
            else if (examDrawer.exam) updateExam.mutate({ id: examDrawer.exam.id, v });
          }}
        >
          <Form.Item name="slug" label="Slug (латиница)" rules={[{ required: examDrawer.mode === 'create' }]}>
            <Input disabled={examDrawer.mode === 'edit'} placeholder="ent" />
          </Form.Item>
          <Form.Item name="name_ru" label="Название RU" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name_kk" label="Название KK">
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label="Название EN">
            <Input />
          </Form.Item>
          <Form.Item name="desc_ru" label="Описание RU">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="desc_kk" label="Описание KK">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="desc_en" label="Описание EN">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="isActive" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={subjectDrawer.mode === 'create' ? 'Новый предмет' : 'Предмет'}
        width={440}
        open={subjectDrawer.open}
        onClose={() => setSubjectDrawer({ open: false, mode: 'create' })}
        destroyOnClose
        extra={
          <Button
            type="primary"
            loading={createSubject.isPending || updateSubject.isPending}
            onClick={() => subjectForm.submit()}
          >
            Сохранить
          </Button>
        }
      >
        <Form
          form={subjectForm}
          layout="vertical"
          onFinish={(v) => {
            if (subjectDrawer.mode === 'create' && subjectDrawer.examId) {
              createSubject.mutate({ examId: subjectDrawer.examId, v });
            } else if (subjectDrawer.mode === 'edit' && subjectDrawer.subject) {
              updateSubject.mutate({ id: subjectDrawer.subject.id, v });
            }
          }}
        >
          <Form.Item name="slug" label="Slug" rules={[{ required: true }]}>
            <Input placeholder="mathematics" />
          </Form.Item>
          <Form.Item name="name_ru" label="Название RU" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name_kk" label="Название KK">
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label="Название EN">
            <Input />
          </Form.Item>
          <Form.Item name="isMandatory" label="Обязательный" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sortOrder" label="Порядок сортировки">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title={`Темы: ${topicModal.subject ? listLabel(topicModal.subject.name, catalogListLang) : ''}`}
        open={topicModal.open}
        onCancel={() => setTopicModal({ open: false })}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ marginBottom: 12 }}
          onClick={() => {
            setTopicFormOpen({ mode: 'create' });
            topicForm.resetFields();
          }}
        >
          Тема
        </Button>
        <Table<TopicRow>
          size="small"
          rowKey="id"
          dataSource={topicModal.subject?.topics || []}
          pagination={false}
          columns={[
            { title: 'Название', render: (_, t) => listLabel(t.name, catalogListLang) },
            { title: 'Порядок', dataIndex: 'sortOrder', width: 90 },
            {
              title: '',
              width: 160,
              render: (_, t) => (
                <Space>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setTopicFormOpen({ mode: 'edit', topic: t });
                      const tpName = splitLocalizedSlot(t.name);
                      topicForm.setFieldsValue({
                        name_ru: tpName.ru,
                        name_kk: tpName.kk,
                        name_en: tpName.en,
                        sortOrder: t.sortOrder,
                      });
                    }}
                  >
                    Изм.
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() => {
                      Modal.confirm({
                        title: 'Удалить тему?',
                        onOk: () => deleteTopic.mutate(t.id),
                      });
                    }}
                  >
                    Удал.
                  </Button>
                </Space>
              ),
            },
          ]}
        />

        {topicFormOpen && (
          <Card size="small" title={topicFormOpen.mode === 'create' ? 'Новая тема' : 'Тема'} style={{ marginTop: 16 }}>
            <Form
              form={topicForm}
              layout="vertical"
              onFinish={(v) => {
                if (!topicModal.subject) return;
                if (topicFormOpen.mode === 'create') {
                  createTopic.mutate({ subjectId: topicModal.subject.id, v });
                } else if (topicFormOpen.topic) {
                  updateTopic.mutate({ id: topicFormOpen.topic.id, v });
                }
              }}
            >
              <Form.Item name="name_ru" label="Название RU" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="name_kk" label="Название KK">
                <Input />
              </Form.Item>
              <Form.Item name="name_en" label="Название EN">
                <Input />
              </Form.Item>
              <Form.Item name="sortOrder" label="Порядок">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={createTopic.isPending || updateTopic.isPending}>
                  Сохранить
                </Button>
                <Button onClick={() => setTopicFormOpen(null)}>Отмена</Button>
              </Space>
            </Form>
          </Card>
        )}
      </Modal>

      <Drawer
        title={`Шаблоны: ${templateDrawer.exam ? listLabel(templateDrawer.exam.name, catalogListLang) : ''}`}
        width={720}
        open={templateDrawer.open}
        onClose={() => setTemplateDrawer({ open: false })}
        destroyOnClose
      >
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ marginBottom: 12 }}
          onClick={() => {
            setTplEditor({ open: true, mode: 'create', examId: templateDrawer.exam?.id });
            templateForm.resetFields();
            templateForm.setFieldsValue({
              durationMins: 120,
              isActive: true,
              sections: [{ subjectId: undefined, questionCount: 10, selectionMode: 'random' }],
            });
          }}
        >
          Шаблон
        </Button>
        <Table<TemplateRow>
          loading={tplLoading}
          size="small"
          rowKey="id"
          dataSource={templates || []}
          pagination={false}
          columns={[
            { title: 'Название', render: (_, r) => listLabel(r.name, catalogListLang) },
            { title: 'Мин', dataIndex: 'durationMins', width: 70 },
            {
              title: 'Акт.',
              dataIndex: 'isActive',
              width: 70,
              render: (v: boolean) => (v ? 'Да' : 'Нет'),
            },
            {
              title: '',
              width: 200,
              render: (_, r) => (
                <Space>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setTplEditor({
                        open: true,
                        mode: 'edit',
                        examId: templateDrawer.exam?.id,
                        template: r,
                      });
                      const tplName = splitLocalizedSlot(r.name);
                      templateForm.setFieldsValue({
                        name_ru: tplName.ru,
                        name_kk: tplName.kk,
                        name_en: tplName.en,
                        durationMins: r.durationMins,
                        isActive: r.isActive,
                        sections: r.sections.map((s) => ({
                          subjectId: s.subjectId,
                          questionCount: s.questionCount,
                          selectionMode: s.selectionMode,
                          profileHeavyFrom: s.profileHeavyFrom ?? undefined,
                        })),
                      });
                    }}
                  >
                    Изменить
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() => {
                      Modal.confirm({
                        title: 'Удалить шаблон?',
                        onOk: () => deleteTemplate.mutate(r.id),
                      });
                    }}
                  >
                    Удалить
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Drawer>

      <Drawer
        title={tplEditor.mode === 'create' ? 'Новый шаблон' : 'Шаблон теста'}
        width={560}
        open={tplEditor.open}
        onClose={() => setTplEditor({ open: false, mode: 'create' })}
        destroyOnClose
        extra={
          <Button type="primary" loading={saveTemplate.isPending} onClick={() => templateForm.submit()}>
            Сохранить
          </Button>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Секции задают предмет и число вопросов. При сохранении существующего шаблона секции полностью заменяются."
        />
        <Form
          form={templateForm}
          layout="vertical"
          onFinish={(values) =>
            saveTemplate.mutate({
              mode: tplEditor.mode,
              examId: tplEditor.examId,
              templateId: tplEditor.template?.id,
              values,
            })
          }
        >
          <Form.Item name="name_ru" label="Название RU" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name_kk" label="Название KK">
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label="Название EN">
            <Input />
          </Form.Item>
          <Form.Item name="durationMins" label="Длительность (мин)" rules={[{ required: true }]}>
            <InputNumber min={1} max={600} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Typography.Text strong>Секции</Typography.Text>
          <Form.List name="sections">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Card key={field.key} size="small" style={{ marginTop: 8 }}>
                    <Space wrap align="start">
                      <Form.Item
                        name={[field.name, 'subjectId']}
                        label="Предмет"
                        rules={[{ required: true }]}
                        style={{ minWidth: 220 }}
                      >
                        <Select
                          placeholder="Предмет"
                          options={(catalog || [])
                            .find((e) => e.id === (tplEditor.examId || templateDrawer.exam?.id))
                            ?.subjects.map((s) => ({
                              value: s.id,
                              label: `${s.slug} — ${listLabel(s.name, catalogListLang)}`,
                            }))}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'questionCount']}
                        label="Вопросов"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={1} max={200} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'selectionMode']} label="Режим" initialValue="random">
                        <Select
                          options={[
                            { value: 'random', label: 'random' },
                            { value: 'ordered', label: 'ordered' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'profileHeavyFrom']}
                        label="ЕНТ: с какого № ×2"
                        tooltip="Только профильный блок: с этого номера по счёту в секции вопрос даёт 2 балла. Пусто — по умолчанию с 31-го."
                      >
                        <InputNumber min={1} max={200} placeholder="31" style={{ width: 120 }} />
                      </Form.Item>
                      {fields.length > 1 && (
                        <Button type="text" danger onClick={() => remove(field.name)}>
                          Удалить секцию
                        </Button>
                      )}
                    </Space>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ selectionMode: 'random' })} block style={{ marginTop: 8 }}>
                  + Секция
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </AdminPageShell>
  );
}
