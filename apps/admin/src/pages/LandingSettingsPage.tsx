import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Image, Input, Space, Switch, Typography, Upload, message, Skeleton } from 'antd';
import {
  PictureOutlined,
  PlusOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { resolveMediaUrl } from '../lib/resolveMediaUrl';

const SOCIAL_LINK_FIELDS = 4;

type LandingSettingsDto = {
  instructionVideoUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
  heroSlides: Array<{
    title?: string;
    subtitle?: string;
    desktopImageUrl: string;
    tabletImageUrl: string;
    mobileImageUrl: string;
    buttonLabel?: string;
    buttonHref?: string;
    showButton?: boolean;
    isActive?: boolean;
  }>;
};

function formatNowRu() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function SlideImageField({
  value,
  onChange,
  label,
}: {
  value?: string;
  onChange?: (url: string) => void;
  label: string;
}) {
  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post<{ url: string }>('/admin/settings/landing/images', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    onChange?.(data.url);
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={6}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      {value ? (
        <Image
          src={resolveMediaUrl(value)}
          alt=""
          style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8 }}
        />
      ) : null}
      <Upload
        accept="image/jpeg,image/png,image/gif,image/webp"
        showUploadList={false}
        customRequest={async (opt) => {
          try {
            await upload(opt.file as File);
            message.success('Изображение загружено');
            opt.onSuccess?.({});
          } catch (e) {
            message.error('Не удалось загрузить изображение');
            opt.onError?.(e as Error);
          }
        }}
      >
        <Button icon={<PictureOutlined />}>Загрузить</Button>
      </Upload>
      <Input
        placeholder="https://... или /uploads/..."
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </Space>
  );
}

export function LandingSettingsPage() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm<LandingSettingsDto>();

  const { data, isFetching, isPending } = useQuery({
    queryKey: ['admin-landing-settings'],
    queryFn: async () => {
      const { data } = await api.get<LandingSettingsDto>('/admin/settings/landing');
      return data;
    },
  });

  const showSkeleton = isPending && !data;

  const slideStats = useMemo(() => {
    const slides = data?.heroSlides ?? [];
    const total = slides.length;
    const active = slides.filter((s) => s.isActive !== false).length;
    const hasVideo = Boolean(data?.instructionVideoUrl?.trim());
    return { total, active, hasVideo };
  }, [data]);

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue({
      ...data,
      heroSlides: (data.heroSlides || []).map((slide) => ({
        ...slide,
        showButton: slide.showButton !== false,
        isActive: slide.isActive !== false,
      })),
    });
  }, [data, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: LandingSettingsDto) => {
      const payload: LandingSettingsDto = {
        ...values,
        heroSlides: (values.heroSlides || []).map((slide) => ({
          ...slide,
          title: slide.title?.trim() ?? '',
          subtitle: slide.subtitle?.trim() ?? '',
          buttonLabel: slide.buttonLabel?.trim() ?? '',
          buttonHref: slide.buttonHref?.trim() ?? '',
          showButton: slide.showButton !== false,
          isActive: slide.isActive !== false,
        })),
      };
      const { data: saved } = await api.patch<LandingSettingsDto>('/admin/settings/landing', payload);
      return saved;
    },
    onSuccess: (saved) => {
      form.setFieldsValue(saved);
      queryClient.invalidateQueries({ queryKey: ['admin-landing-settings'] });
      queryClient.invalidateQueries({ queryKey: ['public-landing-settings'] });
      message.success('Настройки лендинга сохранены');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg || 'Не удалось сохранить настройки');
    },
  });

  if (showSkeleton) {
    return (
      <AdminPageShell wide>
        <div className="pg-landing-page">
          <Skeleton active className="pg-landing-page__skeleton-hero" paragraph={{ rows: 0 }} />
          <div className="pg-landing-page__stat-strip">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton.Button key={i} active block style={{ height: 86, borderRadius: 16 }} />
            ))}
          </div>
          <Skeleton active className="pg-landing-page__skeleton-form" paragraph={{ rows: 10 }} />
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell wide>
      <div className="pg-landing-page">
        <div className="pg-landing-page__hero pg-dash__hero">
          <div>
            <p className="pg-dash__eyebrow">
              <GlobalOutlined /> Главная my-test.kz
            </p>
            <h1 className="pg-dash__headline">Настройки лендинга</h1>
            <p className="pg-dash__lede">
              Всё, что видит гость на главной: инструкция, соцсети и картинки карусели для трёх ширин экрана. После
              сохранения настройки отдаются публичному API лендинга.
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

        <div className="pg-landing-page__stat-strip">
          <div className="pg-landing-page__stat pg-landing-page__stat--blue">
            <span className="pg-landing-page__stat-icon">
              <PictureOutlined />
            </span>
            <div className="pg-landing-page__stat-body">
              <span className="pg-landing-page__stat-k">Слайдов в карусели</span>
              <span className="pg-landing-page__stat-v">{slideStats.total.toLocaleString('ru-RU')}</span>
            </div>
          </div>
          <div className="pg-landing-page__stat pg-landing-page__stat--violet">
            <span className="pg-landing-page__stat-icon">
              <CheckCircleOutlined />
            </span>
            <div className="pg-landing-page__stat-body">
              <span className="pg-landing-page__stat-k">Активных слайдов</span>
              <span className="pg-landing-page__stat-v">{slideStats.active.toLocaleString('ru-RU')}</span>
            </div>
          </div>
          <div className="pg-landing-page__stat pg-landing-page__stat--teal">
            <span className="pg-landing-page__stat-icon">
              <LinkOutlined />
            </span>
            <div className="pg-landing-page__stat-body">
              <span className="pg-landing-page__stat-k">Соц. ссылки (поля)</span>
              <span className="pg-landing-page__stat-v">{SOCIAL_LINK_FIELDS}</span>
            </div>
          </div>
          <div className="pg-landing-page__stat pg-landing-page__stat--amber">
            <span className="pg-landing-page__stat-icon">
              <PlayCircleOutlined />
            </span>
            <div className="pg-landing-page__stat-body">
              <span className="pg-landing-page__stat-k">Видео-инструкция</span>
              <span className="pg-landing-page__stat-v pg-landing-page__stat-v--sm">
                {slideStats.hasVideo ? 'Задан URL' : '—'}
              </span>
            </div>
          </div>
        </div>

        <Card className="hig-surface-card pg-landing-page__sheet pg-landing-page__sheet--accent">
          <Form<LandingSettingsDto>
            form={form}
            layout="vertical"
            onFinish={(values) => saveMutation.mutate(values)}
            initialValues={{
              instructionVideoUrl: '',
              instagramUrl: '',
              tiktokUrl: '',
              whatsappUrl: '',
              heroSlides: [],
            }}
          >
            <div className="pg-landing">
              <div className="pg-landing__grid">
                <aside className="pg-landing__aside">
                  <h3>Видео и соцсети</h3>
                  <Form.Item
                    name="instructionVideoUrl"
                    label="Видео-инструкция"
                    extra="YouTube — встраивается на лендинге"
                    rules={[{ required: true, type: 'url', message: 'Введите корректный URL' }]}
                  >
                    <Input placeholder="https://youtu.be/..." />
                  </Form.Item>

                  <Form.Item
                    name="instagramUrl"
                    label="Instagram"
                    rules={[{ required: true, type: 'url', message: 'Введите корректный URL' }]}
                  >
                    <Input placeholder="https://instagram.com/..." />
                  </Form.Item>

                  <Form.Item
                    name="tiktokUrl"
                    label="TikTok"
                    rules={[{ required: true, type: 'url', message: 'Введите корректный URL' }]}
                  >
                    <Input placeholder="https://www.tiktok.com/..." />
                  </Form.Item>

                  <Form.Item
                    name="whatsappUrl"
                    label="WhatsApp"
                    rules={[{ required: true, type: 'url', message: 'Введите корректный URL' }]}
                  >
                    <Input placeholder="https://wa.me/..." />
                  </Form.Item>
                </aside>

                <div className="pg-landing__main">
                  <div className="pg-landing__slides-head">Карусель (desktop / tablet / mobile)</div>
                  <div className="pg-landing__slides">
                    <Form.List name="heroSlides">
                      {(fields, { add, remove }) => (
                        <Space direction="vertical" size={14} style={{ width: '100%' }}>
                          {fields.map((field, idx) => (
                            <Card
                              key={field.key}
                              className="hig-landing-slide"
                              size="small"
                              title={`Слайд ${idx + 1}`}
                              extra={
                                <Button danger type="text" onClick={() => remove(field.name)}>
                                  Удалить
                                </Button>
                              }
                            >
                              <Form.Item name={[field.name, 'title']} label="Заголовок">
                                <Input placeholder="Необязательно" />
                              </Form.Item>
                              <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
                                <Form.Item
                                  name={[field.name, 'isActive']}
                                  label="Показывать слайд"
                                  valuePropName="checked"
                                >
                                  <Switch />
                                </Form.Item>
                                <Form.Item
                                  name={[field.name, 'showButton']}
                                  label="Показывать кнопку"
                                  valuePropName="checked"
                                >
                                  <Switch />
                                </Form.Item>
                              </div>
                              <Form.Item name={[field.name, 'subtitle']} label="Подзаголовок">
                                <Input.TextArea rows={2} />
                              </Form.Item>
                              <Form.Item name={[field.name, 'buttonLabel']} label="Текст кнопки">
                                <Input placeholder="Начать тест" />
                              </Form.Item>
                              <Form.Item name={[field.name, 'buttonHref']} label="Ссылка кнопки">
                                <Input placeholder="/login или https://..." />
                              </Form.Item>
                              <div
                                style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
                              >
                                <Form.Item
                                  name={[field.name, 'desktopImageUrl']}
                                  rules={[{ required: true, message: 'Нужно изображение desktop' }]}
                                >
                                  <SlideImageField label="Desktop" />
                                </Form.Item>
                                <Form.Item
                                  name={[field.name, 'tabletImageUrl']}
                                  rules={[{ required: true, message: 'Нужно изображение tablet' }]}
                                >
                                  <SlideImageField label="Tablet" />
                                </Form.Item>
                                <Form.Item
                                  name={[field.name, 'mobileImageUrl']}
                                  rules={[{ required: true, message: 'Нужно изображение mobile' }]}
                                >
                                  <SlideImageField label="Mobile" />
                                </Form.Item>
                              </div>
                            </Card>
                          ))}
                          <Button
                            icon={<PlusOutlined />}
                            onClick={() =>
                              add({
                                title: '',
                                subtitle: '',
                                buttonLabel: '',
                                buttonHref: '',
                                showButton: true,
                                isActive: true,
                                desktopImageUrl: '',
                                tabletImageUrl: '',
                                mobileImageUrl: '',
                              })
                            }
                          >
                            Добавить слайд
                          </Button>
                        </Space>
                      )}
                    </Form.List>
                  </div>
                </div>
              </div>

              <div className="pg-landing-page__actions">
                <Button type="primary" htmlType="submit" size="large" loading={saveMutation.isPending}>
                  Сохранить настройки лендинга
                </Button>
              </div>
            </div>
          </Form>
        </Card>
      </div>
    </AdminPageShell>
  );
}
