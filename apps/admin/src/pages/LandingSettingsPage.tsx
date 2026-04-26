import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Image, Input, Space, Switch, Typography, Upload, message } from 'antd';
import { PictureOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { resolveMediaUrl } from '../lib/resolveMediaUrl';

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

  const { data, isLoading } = useQuery({
    queryKey: ['admin-landing-settings'],
    queryFn: async () => {
      const { data } = await api.get<LandingSettingsDto>('/admin/settings/landing');
      return data;
    },
  });

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
      const { data } = await api.patch<LandingSettingsDto>('/admin/settings/landing', payload);
      return data;
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

  return (
    <AdminPageShell wide>
      <Card loading={isLoading} className="hig-surface-card">
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
            <p className="pg-landing__intro">
              Всё, что видит гость на главной: инструкция, соцсети и картинки карусели для трёх ширин экрана. Сохранение
              сразу отдаётся публичному API лендинга.
            </p>

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
                      <Form.Item name={[field.name, 'isActive']} label="Показывать слайд" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                      <Form.Item name={[field.name, 'showButton']} label="Показывать кнопку" valuePropName="checked">
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
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
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

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '0.5px solid rgba(60,60,67,0.12)' }}>
              <Button type="primary" htmlType="submit" size="large" loading={saveMutation.isPending}>
                Сохранить настройки лендинга
              </Button>
            </div>
          </div>
        </Form>
      </Card>
    </AdminPageShell>
  );
}
