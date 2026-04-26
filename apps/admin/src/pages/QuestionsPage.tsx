import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
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
  Spin,
  Upload,
  Image,
  Collapse,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, GlobalOutlined, PictureOutlined, InfoCircleOutlined } from '@ant-design/icons';
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
  splitLocalizedSlot,
  type AdminLocaleFilter,
} from '../lib/questionContent';
import { resolveApiBaseUrl } from '../lib/resolveApiBaseUrl';
import { resolveMediaUrl } from '../lib/resolveMediaUrl';

const { TextArea } = Input;

function normalizeImageUrls(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  }
  return [];
}

function questionImageUploadUrl(): string {
  const base = resolveApiBaseUrl({
    viteApiUrl: import.meta.env.VITE_API_URL,
    viteSiteUrl:
      import.meta.env.VITE_SITE_URL || (import.meta.env.PROD ? 'https://my-test.kz' : undefined),
    viteProd: import.meta.env.PROD,
  });
  const path = `${base.replace(/\/+$/, '')}/admin/questions/images`;
  if (base.startsWith('http')) return path;
  return `${window.location.origin.replace(/\/$/, '')}${path}`;
}

function QuestionImageUrlsField({
  value = [],
  onChange,
}: {
  value?: string[];
  onChange?: (urls: string[]) => void;
}) {
  const urls = value || [];
  const remove = (idx: number) => {
    onChange?.(urls.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <Space wrap align="start" style={{ marginBottom: 12 }}>
        {urls.map((u, i) => (
          <div
            key={`${u}-${i}`}
            style={{
              border: '1px solid var(--ant-color-border)',
              borderRadius: 8,
              padding: 8,
              background: 'var(--ant-color-fill-quaternary)',
            }}
          >
            <Image
              src={resolveMediaUrl(u)}
              alt=""
              style={{ maxHeight: 160, maxWidth: 280, objectFit: 'contain', display: 'block' }}
            />
            <Button type="link" size="small" danger onClick={() => remove(i)} style={{ padding: 0 }}>
              Удалить
            </Button>
          </div>
        ))}
      </Space>
      <Upload
        accept="image/jpeg,image/png,image/gif,image/webp"
        showUploadList={false}
        maxCount={8}
        disabled={urls.length >= 8}
        customRequest={async (opt) => {
          const { file, onError, onSuccess } = opt;
          try {
            const fd = new FormData();
            fd.append('file', file as File);
            const token = localStorage.getItem('admin_accessToken');
            const res = await fetch(questionImageUploadUrl(), {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: fd,
            });
            if (!res.ok) {
              const txt = await res.text();
              throw new Error(txt || res.statusText);
            }
            const data = (await res.json()) as { url: string };
            if (data?.url) {
              onChange?.([...urls, data.url]);
              message.success('Изображение загружено');
            }
            onSuccess?.(data);
          } catch (e) {
            message.error('Не удалось загрузить изображение');
            onError?.(e as Error);
          }
        }}
      >
        <Button icon={<PictureOutlined />} disabled={urls.length >= 8}>
          Загрузить изображение (jpeg, png, gif, webp, до 5 МБ)
        </Button>
      </Upload>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
        Файлы сохраняются на сервере в <Typography.Text code>/uploads/question-images/</Typography.Text>. В БД
        хранится путь — в тесте картинки подставляются автоматически.
      </Typography.Paragraph>
    </div>
  );
}

type CatalogTopic = { id: string; name: unknown; sortOrder: number };
type CatalogSubject = {
  id: string;
  topics: CatalogTopic[];
};
type CatalogExam = { id: string; subjects: CatalogSubject[] };

type CatalogSearchRow = {
  id: string;
  score: number;
  preview: string;
  subjectSlug?: string | null;
  subjectName?: unknown;
  topicName?: unknown;
};

interface Question {
  id: string;
  examTypeId: string;
  subjectId: string;
  topicId: string;
  difficulty: number;
  /** ЕНТ: явный вес; null — по правилу секции шаблона */
  scoreWeight?: number | null;
  type: string;
  content: unknown;
  explanation: unknown;
  imageUrls?: unknown;
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

function answersToFormList(q: Question) {
  return (q.answerOptions || []).map((opt) => ({
    ru: pickContentLang(opt.content, 'ru'),
    kk: pickContentLang(opt.content, 'kk'),
    en: pickContentLang(opt.content, 'en'),
    isCorrect: opt.isCorrect,
  }));
}

function MarkdownTextArea(props: any) {
  const { value, onChange, useQuestionImagePool = true, ...rest } = props;
  const inputRef = useRef<any>(null);
  /** Form может отдать undefined до гидратации — иначе TextArea остаётся «неконтролируемым» и не подхватывает setFieldsValue. */
  const textValue = typeof value === 'string' ? value : '';
  const controlledValue = textValue;
  const form = Form.useFormInstance();
  const watchedImageUrls = Form.useWatch('imageUrls', form);
  /** Пул условия вопроса: в объяснении загрузка не должна попадать сюда — иначе картинка в «отдельном» блоке на клиенте до разбора. */
  const imagePool = useMemo(
    () => (useQuestionImagePool ? normalizeImageUrls(watchedImageUrls) : []),
    [useQuestionImagePool, watchedImageUrls],
  );

  const markdownImages = useMemo(() => {
    const out: Array<{ alt: string; url: string }> = [];
    const re = /!\[([^\]]*)\]\(([^)]+)\)|\[!([^\]]*)\]\(([^)]+)\)|\[\[img:(\d+)\]\]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(textValue)) !== null) {
      const tokenNumRaw = m[5];
      if (tokenNumRaw) {
        const tokenNum = Number.parseInt(tokenNumRaw, 10);
        const tokenIdx = tokenNum - 1;
        const mapped = tokenIdx >= 0 && tokenIdx < imagePool.length ? imagePool[tokenIdx] : '';
        if (!mapped) continue;
        out.push({ alt: `image-${tokenNum}`, url: mapped });
        continue;
      }
      const alt = String(m[1] ?? m[3] ?? '').trim();
      const url = String(m[2] ?? m[4] ?? '').trim();
      if (!url) continue;
      out.push({ alt, url });
    }
    return out;
  }, [textValue, imagePool]);

  const insertAtCursor = (snippet: string) => {
    const textarea = inputRef.current?.resizableTextArea?.textArea;
    const start = textarea?.selectionStart || 0;
    const end = textarea?.selectionEnd || 0;
    const currentVal = controlledValue;
    const newVal = currentVal.substring(0, start) + snippet + currentVal.substring(end);
    onChange?.(newVal);
    setTimeout(() => {
      if (!textarea) return;
      textarea.focus();
      const pos = start + snippet.length;
      textarea.setSelectionRange(pos, pos);
    }, 10);
  };
  
  const handleInsertImage = (url: string) => {
    if (!form || !useQuestionImagePool) {
      insertAtCursor(`\n\n![image](${url})\n\n`);
      return;
    }

    let pool = imagePool;
    let idx = pool.findIndex((u) => u === url);
    if (idx === -1) {
      pool = [...pool, url];
      form.setFieldsValue({ imageUrls: pool });
      idx = pool.length - 1;
    }
    // Big-text UX: keep content readable, store full URL in dedicated image pool.
    insertAtCursor(`\n\n[[img:${idx + 1}]]\n\n`);
  };

  return (
    <div style={{ position: 'relative' }}>
      <TextArea ref={inputRef} value={controlledValue} onChange={onChange} {...rest} />
      <Upload
        accept="image/jpeg,image/png,image/gif,image/webp"
        showUploadList={false}
        customRequest={async (opt) => {
          const { file, onError, onSuccess } = opt;
          try {
            const fd = new FormData();
            fd.append('file', file as File);
            const token = localStorage.getItem('admin_accessToken');
            const res = await fetch(questionImageUploadUrl(), {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: fd,
            });
            if (!res.ok) throw new Error(await res.text());
            const data = (await res.json()) as { url: string };
            if (data?.url) {
              handleInsertImage(data.url);
              message.success('Вставлено изображение');
            }
            onSuccess?.(data);
          } catch (e) {
            message.error('Не удалось загрузить изображение');
            onError?.(e as Error);
          }
        }}
      >
        <Tooltip
          title={
            useQuestionImagePool
              ? 'Вставить изображение в текст'
              : 'В объяснение: вставка только в этот текст (не в общий пул иллюстраций к условию)'
          }
        >
          <Button 
            icon={<PictureOutlined />} 
            size="small" 
            type="text" 
            style={{ position: 'absolute', top: 4, right: 4, background: 'var(--surface-elevated)', zIndex: 1 }} 
          />
        </Tooltip>
      </Upload>
      {markdownImages.length > 0 && (
        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}
        >
          {markdownImages.map((img, idx) => (
            <div
              key={`${img.url}-${idx}`}
              style={{
                border: '1px solid var(--ant-color-border)',
                borderRadius: 8,
                padding: 6,
                background: 'var(--ant-color-fill-quaternary)',
              }}
            >
              <Image
                src={resolveMediaUrl(img.url)}
                alt={img.alt || `image-${idx + 1}`}
                style={{ width: '100%', maxHeight: 120, objectFit: 'contain' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const [catalogSearchTopic, setCatalogSearchTopic] = useState('');
  const [catalogSearchStem, setCatalogSearchStem] = useState('');
  const [catalogSearchAll, setCatalogSearchAll] = useState('');
  const debouncedCatalogTopic = useDebouncedValue(catalogSearchTopic, 420);
  const debouncedCatalogStem = useDebouncedValue(catalogSearchStem, 420);
  const debouncedCatalogAll = useDebouncedValue(catalogSearchAll, 420);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const localeParams = useMemo(() => localeFilterParam(localeFilter), [localeFilter]);

  const stemRu = Form.useWatch('stem_ru', form);
  const topicRu = Form.useWatch('topic_ru', form);
  const passageRu = Form.useWatch('passage_ru', form);
  const stemKk = Form.useWatch('stem_kk', form);
  const topicKk = Form.useWatch('topic_kk', form);
  const passageKk = Form.useWatch('passage_kk', form);
  const contentLocaleWatch = Form.useWatch('contentLocale', form);
  const formSubjectId = Form.useWatch('subjectId', form);
  const formExamTypeId = Form.useWatch('examTypeId', form);

  const similaritySource = useMemo(() => {
    const loc = contentLocaleWatch === 'kk' ? 'kk' : 'ru';
    return buildSimilarityNeedle(
      {
        passage_ru: passageRu || '',
        passage_kk: passageKk || '',
        topic_ru: topicRu || '',
        stem_ru: stemRu || '',
        topic_kk: topicKk || '',
        stem_kk: stemKk || '',
      },
      loc,
    );
  }, [contentLocaleWatch, passageRu, passageKk, topicRu, stemRu, topicKk, stemKk]);

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

  const { data: examCatalog } = useQuery({
    queryKey: ['admin-exams-catalog'],
    queryFn: async () => (await api.get<CatalogExam[]>('/admin/exams/catalog')).data,
    staleTime: 60_000,
    enabled: drawerOpen,
  });

  const topicsForSubject = useMemo(() => {
    if (!examCatalog?.length || !formExamTypeId || !formSubjectId) return [];
    const exam = examCatalog.find((e) => e.id === formExamTypeId);
    const subj = exam?.subjects?.find((s) => s.id === formSubjectId);
    return subj?.topics ?? [];
  }, [examCatalog, formExamTypeId, formSubjectId]);

  const topicSelectOptions = useMemo(() => {
    const opts = topicsForSubject.map((t) => ({
      value: t.id,
      label: getLocalizedText(t.name),
    }));
    if (editorMode === 'edit' && editingQuestion?.topicId) {
      const tid = editingQuestion.topicId;
      if (!opts.some((o) => o.value === tid)) {
        opts.unshift({
          value: tid,
          label: editingQuestion.topic
            ? getLocalizedText(editingQuestion.topic.name)
            : `Тема (${tid.slice(0, 8)}…)`,
        });
      }
    }
    return opts;
  }, [topicsForSubject, editorMode, editingQuestion]);

  useEffect(() => {
    if (!drawerOpen || editorMode !== 'create' || topicsForSubject.length === 0) return;
    const cur = form.getFieldValue('topicId') as string | undefined;
    const valid = cur && topicsForSubject.some((t) => t.id === cur);
    if (!valid) {
      form.setFieldsValue({ topicId: topicsForSubject[0].id });
    }
  }, [drawerOpen, editorMode, topicsForSubject, form]);

  useLayoutEffect(() => {
    if (!drawerOpen || editorMode !== 'edit' || !editingQuestion) return;
    const exp = splitLocalizedSlot(editingQuestion.explanation);
    const meta = editingQuestion.metadata as { contentLocale?: string } | undefined;
    form.setFieldsValue({
      examTypeId: editingQuestion.examTypeId,
      subjectId: editingQuestion.subjectId,
      topicId: editingQuestion.topicId,
      contentLocale: meta?.contentLocale === 'kk' ? 'kk' : 'ru',
      difficulty: editingQuestion.difficulty,
      scoreWeight: editingQuestion.scoreWeight ?? undefined,
      type: editingQuestion.type,
      ...parseQuestionFormSlots(editingQuestion.content, getQuestionContentLocale(editingQuestion.metadata)),
      explanation_ru: exp.ru,
      explanation_kk: exp.kk,
      explanation_en: exp.en,
      answers: answersToFormList(editingQuestion),
      imageUrls: normalizeImageUrls(editingQuestion.imageUrls),
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
      debouncedSimilaritySource.trim().length >= 6,
  });

  const catalogTopicEnabled = !!examTypeId && debouncedCatalogTopic.trim().length >= 2;
  const catalogStemEnabled = !!examTypeId && debouncedCatalogStem.trim().length >= 4;
  const catalogAllEnabled = !!examTypeId && debouncedCatalogAll.trim().length >= 4;

  const { data: catalogTopicData, isFetching: catalogTopicFetching } = useQuery({
    queryKey: [
      'admin-questions-catalog-search',
      'topic',
      examTypeId,
      subjectId,
      debouncedCatalogTopic,
      previewLang,
    ],
    queryFn: async () => {
      const { data } = await api.get<{ items: CatalogSearchRow[] }>('/admin/questions/similar', {
        params: {
          examTypeId,
          ...(subjectId ? { subjectId } : {}),
          locale: previewLang === 'kk' ? 'kk' : 'ru',
          limit: 40,
          text: debouncedCatalogTopic.trim(),
          searchIn: 'topic',
          threshold: 0.32,
        },
      });
      return data;
    },
    enabled: catalogTopicEnabled,
  });

  const { data: catalogStemData, isFetching: catalogStemFetching } = useQuery({
    queryKey: [
      'admin-questions-catalog-search',
      'stem',
      examTypeId,
      subjectId,
      debouncedCatalogStem,
      previewLang,
    ],
    queryFn: async () => {
      const { data } = await api.get<{ items: CatalogSearchRow[] }>('/admin/questions/similar', {
        params: {
          examTypeId,
          ...(subjectId ? { subjectId } : {}),
          locale: previewLang === 'kk' ? 'kk' : 'ru',
          limit: 40,
          text: debouncedCatalogStem.trim(),
          searchIn: 'stem',
          threshold: 0.4,
        },
      });
      return data;
    },
    enabled: catalogStemEnabled,
  });

  const { data: catalogAllData, isFetching: catalogAllFetching } = useQuery({
    queryKey: [
      'admin-questions-catalog-search',
      'all',
      examTypeId,
      subjectId,
      debouncedCatalogAll,
      previewLang,
    ],
    queryFn: async () => {
      const { data } = await api.get<{ items: CatalogSearchRow[] }>('/admin/questions/similar', {
        params: {
          examTypeId,
          ...(subjectId ? { subjectId } : {}),
          locale: previewLang === 'kk' ? 'kk' : 'ru',
          limit: 40,
          text: debouncedCatalogAll.trim(),
          searchIn: 'all',
          threshold: 0.4,
        },
      });
      return data;
    },
    enabled: catalogAllEnabled,
  });

  const showCatalogTopicHint =
    catalogTopicEnabled && !catalogTopicFetching && !!catalogTopicData && catalogTopicData.items.length === 0;
  const showCatalogStemHint =
    catalogStemEnabled && !catalogStemFetching && !!catalogStemData && catalogStemData.items.length === 0;
  const showCatalogAllHint =
    catalogAllEnabled && !catalogAllFetching && !!catalogAllData && catalogAllData.items.length === 0;

  const openCreate = () => {
    setEditorMode('create');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      examTypeId: examTypeId || undefined,
      subjectId: subjectId || undefined,
      contentLocale: 'ru',
      difficulty: 3,
      scoreWeight: undefined,
      type: 'single_choice',
      passage_ru: '',
      passage_kk: '',
      passage_en: '',
      topic_ru: '',
      stem_ru: '',
      topic_kk: '',
      stem_kk: '',
      topic_en: '',
      stem_en: '',
      answers: [{}, {}, {}, {}],
      imageUrls: [],
    });
    setDrawerOpen(true);
  };

  const openEdit = (record: Pick<Question, 'id'>) => {
    setEditorMode('edit');
    setEditingId(record.id);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openCreateWithStem = (stem: string) => {
    const t = stem.trim();
    setEditorMode('create');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      examTypeId: examTypeId || undefined,
      subjectId: subjectId || undefined,
      contentLocale: previewLang === 'kk' ? 'kk' : 'ru',
      difficulty: 3,
      scoreWeight: undefined,
      type: 'single_choice',
      passage_ru: '',
      passage_kk: '',
      passage_en: '',
      topic_ru: '',
      stem_ru: previewLang === 'ru' ? t : '',
      topic_kk: '',
      stem_kk: previewLang === 'kk' ? t : '',
      topic_en: '',
      stem_en: '',
      answers: [{}, {}, {}, {}],
      imageUrls: [],
    });
    setDrawerOpen(true);
  };

  const openCreateWithTopicLine = (topicLine: string) => {
    const t = topicLine.trim();
    setEditorMode('create');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      examTypeId: examTypeId || undefined,
      subjectId: subjectId || undefined,
      contentLocale: previewLang === 'kk' ? 'kk' : 'ru',
      difficulty: 3,
      scoreWeight: undefined,
      type: 'single_choice',
      passage_ru: '',
      passage_kk: '',
      passage_en: '',
      topic_ru: previewLang === 'ru' ? t : '',
      stem_ru: '',
      topic_kk: previewLang === 'kk' ? t : '',
      stem_kk: '',
      topic_en: '',
      stem_en: '',
      answers: [{}, {}, {}, {}],
      imageUrls: [],
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
    form.resetFields();
  };

  const catalogSearchColumns: ColumnsType<CatalogSearchRow> = [
    {
      title: 'Сходство',
      width: 88,
      dataIndex: 'score',
      render: (s: number) => <Typography.Text strong>{Math.round(s * 100)}%</Typography.Text>,
    },
    {
      title: 'Предмет',
      width: 110,
      ellipsis: true,
      render: (_: unknown, r: CatalogSearchRow) => r.subjectSlug || '—',
    },
    {
      title: 'Тема (банк)',
      width: 140,
      ellipsis: true,
      render: (_: unknown, r: CatalogSearchRow) => getLocalizedText(r.topicName) || '—',
    },
    {
      title: 'Фрагмент',
      ellipsis: true,
      dataIndex: 'preview',
      render: (text: string) => (
        <Tooltip title={text && text.length > 120 ? text : undefined}>
          <span>{text || '—'}</span>
        </Tooltip>
      ),
    },
    {
      title: '',
      width: 100,
      fixed: 'right',
      render: (_: unknown, r: CatalogSearchRow) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit({ id: r.id })}>
          Изменить
        </Button>
      ),
    },
  ];

  const buildPayload = (values: Record<string, unknown>) => {
    const answers = values.answers as Array<{ ru?: string; kk?: string; en?: string; isCorrect?: boolean }>;
    const content = buildQuestionContentJson({
      passage_ru: (values.passage_ru as string) || '',
      passage_kk: (values.passage_kk as string) || '',
      passage_en: (values.passage_en as string) || '',
      topic_ru: (values.topic_ru as string) || '',
      stem_ru: (values.stem_ru as string) || '',
      topic_kk: (values.topic_kk as string) || '',
      stem_kk: (values.stem_kk as string) || '',
      topic_en: (values.topic_en as string) || '',
      stem_en: (values.stem_en as string) || '',
    });
    return {
      topicId: String(values.topicId || '').trim(),
      subjectId: values.subjectId as string,
      examTypeId: values.examTypeId as string,
      difficulty: values.difficulty as number,
      scoreWeight:
        values.scoreWeight === undefined ||
        values.scoreWeight === null ||
        values.scoreWeight === ''
          ? null
          : Math.max(1, Math.min(5, Math.round(Number(values.scoreWeight)))),
      type: values.type as string,
      contentLocale: values.contentLocale === 'kk' ? 'kk' : 'ru',
      content,
      explanation: (() => {
        const ru = String(values.explanation_ru || '').trim();
        const kk = String(values.explanation_kk || '').trim();
        const en = String(values.explanation_en || '').trim();
        if (!ru && !kk && !en) return undefined;
        return { ru, kk, en };
      })(),
      answerOptions: answers.map((a, i) => ({
        content: { kk: a.kk || '', ru: a.ru || '', en: a.en || '' },
        isCorrect: a.isCorrect || false,
        sortOrder: i,
      })),
      imageUrls: normalizeImageUrls(values.imageUrls),
    };
  };

  const saveQuestion = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const topicId = String(values.topicId || '').trim();
      if (!topicId) {
        message.error('Выберите тему (раздел банка) — UUID из каталога topics, не предмет.');
        throw new Error('Missing topicId');
      }
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
        title: 'Балл',
        width: 72,
        render: (_: unknown, r: Question) =>
          r.scoreWeight != null ? <Tag>{r.scoreWeight}</Tag> : <Tag color="default">авто</Tag>,
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
      <div className="admin-page-toolbar" style={{ marginBottom: 12 }}>
        <div className="admin-page-toolbar-end" style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Tooltip
            title={
              <>
                Условие: JSON <Typography.Text code>topicLine</Typography.Text> +{' '}
                <Typography.Text code>text</Typography.Text>. Похожие вопросы — по словам и биграммам (≥0,85 — возможный
                дубликат).
              </>
            }
          >
            <Button type="text" icon={<InfoCircleOutlined />} size="small" style={{ color: 'var(--admin-muted)' }} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Добавить
          </Button>
        </div>
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

      {!!examTypeId && (
        <Card size="small" title="Поиск по каталогу вопросов" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Три независимых запроса: по подписи блока (topicLine), по тексту вопроса (материал + условие + подсказка) и
              общий по всем полям. Сравнение идёт по RU и KK одновременно. Переключатель KK/RU над таблицей влияет на
              приоритет превью в результатах. Без выбора предмета поиск охватывает все предметы типа экзамена.
            </Typography.Text>

            <div>
              <Typography.Text strong>По названию блока (topicLine)</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
                Не менее 2 символов.
              </Typography.Paragraph>
              <Input
                allowClear
                placeholder="Например: Тапсырма 3, §12…"
                value={catalogSearchTopic}
                onChange={(e) => setCatalogSearchTopic(e.target.value)}
                suffix={catalogTopicFetching ? <Spin size="small" /> : null}
              />
              <Table<CatalogSearchRow>
                style={{ marginTop: 10 }}
                size="small"
                rowKey="id"
                columns={catalogSearchColumns}
                dataSource={catalogTopicData?.items ?? []}
                pagination={{ pageSize: 8, hideOnSinglePage: true, size: 'small' }}
                locale={{ emptyText: catalogTopicEnabled && !catalogTopicFetching ? 'Нет совпадений' : ' ' }}
                scroll={{ x: 620 }}
              />
              {showCatalogTopicHint && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                  message="Похожих по названию блока не найдено"
                  description={
                    <Button type="primary" size="small" onClick={() => openCreateWithTopicLine(debouncedCatalogTopic)}>
                      Создать вопрос с этой подписью блока
                    </Button>
                  }
                />
              )}
            </div>

            <Divider style={{ margin: '4px 0' }} />

            <div>
              <Typography.Text strong>По тексту вопроса (материал и условие)</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
                Не менее 4 символов. Без учёта topicLine.
              </Typography.Paragraph>
              <Input
                allowClear
                placeholder="Фрагмент условия или текста для чтения…"
                value={catalogSearchStem}
                onChange={(e) => setCatalogSearchStem(e.target.value)}
                suffix={catalogStemFetching ? <Spin size="small" /> : null}
              />
              <Table<CatalogSearchRow>
                style={{ marginTop: 10 }}
                size="small"
                rowKey="id"
                columns={catalogSearchColumns}
                dataSource={catalogStemData?.items ?? []}
                pagination={{ pageSize: 8, hideOnSinglePage: true, size: 'small' }}
                locale={{ emptyText: catalogStemEnabled && !catalogStemFetching ? 'Нет совпадений' : ' ' }}
                scroll={{ x: 620 }}
              />
              {showCatalogStemHint && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                  message="Похожих по тексту не найдено"
                  description={
                    <Button type="primary" size="small" onClick={() => openCreateWithStem(debouncedCatalogStem)}>
                      Создать вопрос с этим текстом в условии
                    </Button>
                  }
                />
              )}
            </div>

            <Divider style={{ margin: '4px 0' }} />

            <div>
              <Typography.Text strong>Общий поиск</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
                Не менее 4 символов. Учитываются материал, подпись блока и условие.
              </Typography.Paragraph>
              <Input
                allowClear
                placeholder="Любой фрагмент из вопроса…"
                value={catalogSearchAll}
                onChange={(e) => setCatalogSearchAll(e.target.value)}
                suffix={catalogAllFetching ? <Spin size="small" /> : null}
              />
              <Table<CatalogSearchRow>
                style={{ marginTop: 10 }}
                size="small"
                rowKey="id"
                columns={catalogSearchColumns}
                dataSource={catalogAllData?.items ?? []}
                pagination={{ pageSize: 8, hideOnSinglePage: true, size: 'small' }}
                locale={{ emptyText: catalogAllEnabled && !catalogAllFetching ? 'Нет совпадений' : ' ' }}
                scroll={{ x: 620 }}
              />
              {showCatalogAllHint && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                  message="Совпадений не найдено"
                  description={
                    <Button type="primary" size="small" onClick={() => openCreateWithStem(debouncedCatalogAll)}>
                      Создать вопрос с этим текстом
                    </Button>
                  }
                />
              )}
            </div>
          </Space>
        </Card>
      )}

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
              name="topicId"
              label="Тема (банк / раздел)"
              rules={[{ required: true, message: 'Выберите тему' }]}
              tooltip="Связь с таблицей topics. Раньше подставлялся subjectId — из‑за этого PATCH давал 500 (FK)."
            >
              <Select
                showSearch
                optionFilterProp="label"
                disabled={topicSelectOptions.length === 0}
                options={topicSelectOptions}
                placeholder={
                  topicSelectOptions.length === 0
                    ? 'Сначала предмет или добавьте темы в каталоге экзаменов'
                    : 'Тема'
                }
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
            <Form.Item
              name="scoreWeight"
              label="Балл (ЕНТ)"
              tooltip="Пусто — считается по шаблону теста (например вопросы 31–40 профиля по 2). Заданное значение переопределяет правило для этого вопроса."
            >
              <InputNumber min={1} max={5} placeholder="Авто" style={{ width: '100%' }} />
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
            <Typography.Text code>topicId</Typography.Text> — UUID темы (topics), обязателен; это не предмет.
            В JSON: <Typography.Text code>passage</Typography.Text> — текст для чтения (Оқу сауаттылығы, тарих),{' '}
            <Typography.Text code>topicLine</Typography.Text> — короткая подпись блока ЕНТ,{' '}
            <Typography.Text code>text</Typography.Text> — формулировка вопроса.
          </Typography.Paragraph>

          <Divider orientation="left">Иллюстрации к условию</Divider>
          <Form.Item name="imageUrls" label="Изображения" initialValue={[]}>
            <QuestionImageUrlsField />
          </Form.Item>

          {contentLocaleWatch === 'kk' ? (
            <>
              <Divider orientation="left">Қазақша (негізгі тіл)</Divider>
              <Form.Item
                name="passage_kk"
                label="Сұрақ мәтіні (KK) — оқылатын бөлім"
                tooltip="Оқу сауаттылығы мәтіні, тарих контексті."
              >
                <MarkdownTextArea placeholder="Мәтін, контекст…" autoSize={{ minRows: 12, maxRows: 40 }} />
              </Form.Item>
              <Form.Item name="topic_kk" label="Бөлім / блок (KK), міндетті емес">
                <MarkdownTextArea placeholder="Қысқа тақырып" autoSize={{ minRows: 2, maxRows: 8 }} />
              </Form.Item>
              <Form.Item
                name="stem_kk"
                label="Сұрақ формулировкасы (KK)"
                dependencies={['contentLocale', 'stem_ru']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const loc = getFieldValue('contentLocale');
                      if (loc === 'ru') return Promise.resolve();
                      if (!(String(value || '').trim())) {
                        return Promise.reject(new Error('Қазақша сұрақ мәтінін толтырыңыз'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <MarkdownTextArea autoSize={{ minRows: 6, maxRows: 22 }} />
              </Form.Item>
              <Collapse
                bordered={false}
                style={{ marginBottom: 8 }}
                items={[
                  {
                    key: 'extra-ru',
                    label: 'Русский (қосымша, міндетті емес)',
                    children: (
                      <>
                        <Form.Item
                          name="passage_ru"
                          label="Текст вопроса (RU) — что читают"
                          tooltip="Мәтін для оқу сауаттылығы, длинный контекст в тарихе и т.д."
                        >
                          <MarkdownTextArea
                            placeholder="Вводный текст, мәтін, исторический отрывок…"
                            autoSize={{ minRows: 8, maxRows: 32 }}
                          />
                        </Form.Item>
                        <Form.Item name="topic_ru" label="Подпись блока / раздел (RU), опционально">
                          <MarkdownTextArea placeholder="Например: Раздел «Алгебра»" autoSize={{ minRows: 2, maxRows: 8 }} />
                        </Form.Item>
                        <Form.Item
                          name="stem_ru"
                          label="Формулировка вопроса (RU)"
                          dependencies={['contentLocale', 'stem_kk']}
                          rules={[
                            ({ getFieldValue }) => ({
                              validator(_, value) {
                                const loc = getFieldValue('contentLocale');
                                if (loc === 'kk') return Promise.resolve();
                                if (!(String(value || '').trim())) {
                                  return Promise.reject(new Error('Заполните формулировку на русском'));
                                }
                                return Promise.resolve();
                              },
                            }),
                          ]}
                        >
                          <MarkdownTextArea
                            placeholder="Что именно спрашивают. LaTeX: $...$"
                            autoSize={{ minRows: 5, maxRows: 18 }}
                          />
                        </Form.Item>
                      </>
                    ),
                  },
                  {
                    key: 'extra-en',
                    label: 'English (optional)',
                    children: (
                      <>
                        <Form.Item name="passage_en" label="Question text / passage (EN)">
                          <MarkdownTextArea autoSize={{ minRows: 6, maxRows: 28 }} />
                        </Form.Item>
                        <Form.Item name="topic_en" label="Section label (EN), optional">
                          <MarkdownTextArea autoSize={{ minRows: 2, maxRows: 10 }} />
                        </Form.Item>
                        <Form.Item name="stem_en" label="Question stem (EN)">
                          <MarkdownTextArea autoSize={{ minRows: 4, maxRows: 16 }} />
                        </Form.Item>
                      </>
                    ),
                  },
                ]}
              />
            </>
          ) : (
            <>
              <Divider orientation="left">Русский (негізгі тіл)</Divider>
              <Form.Item
                name="passage_ru"
                label="Текст вопроса (RU) — что читают"
                tooltip="Мәтін для оқу сауаттылығы, длинный контекст в тарихе и т.д. Не путать с подписью раздела ЕНТ."
              >
                <MarkdownTextArea
                  placeholder="Вводный текст, мәтін, исторический отрывок…"
                  autoSize={{ minRows: 12, maxRows: 40 }}
                />
              </Form.Item>
              <Form.Item
                name="topic_ru"
                label="Подпись блока / раздел (RU), опционально"
                tooltip="Короткая строка ЕНТ («Раздел …»). Не заменяет текст вопроса выше."
              >
                <MarkdownTextArea placeholder="Например: Раздел «Алгебра»" autoSize={{ minRows: 2, maxRows: 8 }} />
              </Form.Item>
              <Form.Item
                name="stem_ru"
                label="Формулировка вопроса (RU)"
                dependencies={['contentLocale', 'stem_kk']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const loc = getFieldValue('contentLocale');
                      if (loc === 'kk') return Promise.resolve();
                      if (!(String(value || '').trim())) {
                        return Promise.reject(new Error('Заполните формулировку на русском'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <MarkdownTextArea
                  placeholder="Что именно спрашивают. LaTeX: $...$"
                  autoSize={{ minRows: 6, maxRows: 22 }}
                />
              </Form.Item>
              <Collapse
                bordered={false}
                style={{ marginBottom: 8 }}
                items={[
                  {
                    key: 'extra-kk',
                    label: 'Қазақша (қосымша, міндетті емес)',
                    children: (
                      <>
                        <Form.Item
                          name="passage_kk"
                          label="Сұрақ мәтіні (KK) — оқылатын бөлім"
                          tooltip="Оқу сауаттылығы мәтіні, тарих контексті."
                        >
                          <MarkdownTextArea placeholder="Мәтін, контекст…" autoSize={{ minRows: 8, maxRows: 32 }} />
                        </Form.Item>
                        <Form.Item name="topic_kk" label="Бөлім / блок (KK), міндетті емес">
                          <MarkdownTextArea placeholder="Қысқа тақырып" autoSize={{ minRows: 2, maxRows: 8 }} />
                        </Form.Item>
                        <Form.Item
                          name="stem_kk"
                          label="Сұрақ формулировкасы (KK)"
                          dependencies={['contentLocale', 'stem_ru']}
                          rules={[
                            ({ getFieldValue }) => ({
                              validator(_, value) {
                                const loc = getFieldValue('contentLocale');
                                if (loc === 'ru') return Promise.resolve();
                                if (!(String(value || '').trim())) {
                                  return Promise.reject(new Error('Қазақша сұрақ мәтінін толтырыңыз'));
                                }
                                return Promise.resolve();
                              },
                            }),
                          ]}
                        >
                          <MarkdownTextArea autoSize={{ minRows: 5, maxRows: 18 }} />
                        </Form.Item>
                      </>
                    ),
                  },
                  {
                    key: 'extra-en',
                    label: 'English (optional)',
                    children: (
                      <>
                        <Form.Item name="passage_en" label="Question text / passage (EN)">
                          <MarkdownTextArea autoSize={{ minRows: 8, maxRows: 32 }} />
                        </Form.Item>
                        <Form.Item name="topic_en" label="Section label (EN), optional">
                          <MarkdownTextArea autoSize={{ minRows: 2, maxRows: 10 }} />
                        </Form.Item>
                        <Form.Item name="stem_en" label="Question stem (EN)">
                          <MarkdownTextArea autoSize={{ minRows: 5, maxRows: 18 }} />
                        </Form.Item>
                      </>
                    ),
                  },
                ]}
              />
            </>
          )}

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
          <Form.Item name="explanation_ru" label="Объяснение (RU)" preserve>
            <MarkdownTextArea rows={2} useQuestionImagePool={false} />
          </Form.Item>
          <Form.Item name="explanation_kk" label="Объяснение (KK)" preserve>
            <MarkdownTextArea rows={2} useQuestionImagePool={false} />
          </Form.Item>
          <Form.Item name="explanation_en" label="Объяснение (EN)" preserve>
            <MarkdownTextArea rows={2} useQuestionImagePool={false} />
          </Form.Item>

          <Typography.Title level={5}>Варианты ответов</Typography.Title>
          <Form.List name="answers" initialValue={[{}, {}, {}, {}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => {
                  const ruField = (
                    <Form.Item
                      key={`${String(field.key)}-ru`}
                      name={[field.name, 'ru']}
                      style={{ flex: 1, marginBottom: 0 }}
                      dependencies={['contentLocale']}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (getFieldValue('contentLocale') === 'kk') return Promise.resolve();
                            if (!String(value || '').trim()) {
                              return Promise.reject(new Error('Заполните вариант (RU)'));
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                    >
                      <MarkdownTextArea
                        placeholder={`Вариант ${index + 1} (RU)`}
                        autoSize={{ minRows: 1, maxRows: 6 }}
                      />
                    </Form.Item>
                  );
                  const kkField = (
                    <Form.Item
                      key={`${String(field.key)}-kk`}
                      name={[field.name, 'kk']}
                      style={{ flex: 1, marginBottom: 0 }}
                      dependencies={['contentLocale']}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (getFieldValue('contentLocale') === 'ru') return Promise.resolve();
                            if (!String(value || '').trim()) {
                              return Promise.reject(new Error('Нұсқауды KK толтырыңыз'));
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                    >
                      <MarkdownTextArea
                        placeholder={`Нұсқа ${index + 1} (KK)`}
                        autoSize={{ minRows: 1, maxRows: 6 }}
                      />
                    </Form.Item>
                  );
                  return (
                  <div
                    key={field.key}
                    style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}
                  >
                    <span style={{ marginTop: 8, fontWeight: 600, width: 22 }}>
                      {String.fromCharCode(65 + index)}.
                    </span>
                    {contentLocaleWatch === 'kk' ? (
                      <>
                        {kkField}
                        {ruField}
                      </>
                    ) : (
                      <>
                        {ruField}
                        {kkField}
                      </>
                    )}
                    <Form.Item name={[field.name, 'isCorrect']} valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Switch checkedChildren="✓" unCheckedChildren="✗" />
                    </Form.Item>
                    {fields.length > 2 && (
                      <Button type="text" danger onClick={() => remove(field.name)}>
                        ✕
                      </Button>
                    )}
                  </div>
                  );
                })}
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
