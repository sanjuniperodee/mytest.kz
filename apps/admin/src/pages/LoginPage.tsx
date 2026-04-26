import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { normalizeKzPhone } from '@bilimland/shared';
import { api, setTokens } from '../api/client';

const { Title } = Typography;

export function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  /** Нормализованный 11-значный номер для шага с кодом */
  const [phoneNormalized, setPhoneNormalized] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    const n = normalizeKzPhone(phone);
    if (!n) {
      message.error('Введите номер телефона Казахстана (как в Telegram-боте).');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/web/request-code', { phone });
      setPhoneNormalized(n);
      setStep('code');
      message.success('Код отправлен в Telegram');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (values: { code: string }) => {
    if (!phoneNormalized && !normalizeKzPhone(phone)) {
      message.error('Номер не сохранён. Вернитесь и введите телефон снова.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/web/verify-code', {
        phone,
        code: values.code,
      });

      if (!data.user.isAdmin) {
        message.error('У вас нет прав администратора');
        return;
      }

      setTokens(data.accessToken, data.refreshToken);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <Card className="admin-login-card">
        <Title level={3} className="hig-signin-hero">
          MyTest · admin
        </Title>
        <p className="admin-login-kicker">Код в Telegram, номер как в боте.</p>

        {step === 'phone' ? (
          <Form onFinish={handleRequestCode} layout="vertical">
            <Form.Item label="Телефон" required>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 707 123 45 67"
                size="large"
                autoFocus
                inputMode="tel"
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Получить код
              </Button>
            </Form.Item>
          </Form>
        ) : (
          <Form onFinish={handleVerifyCode} layout="vertical">
            <p className="hig-code-hint">
              Код отправлен в Telegram для номера{' '}
              <strong>{phoneNormalized ? `+${phoneNormalized}` : phone}</strong>
            </p>
            <Form.Item
              name="code"
              label="Код"
              rules={[{ required: true, len: 6, message: 'Введите 6-значный код' }]}
            >
              <Input
                size="large"
                maxLength={6}
                style={{ textAlign: 'center', letterSpacing: 8, fontSize: 24 }}
                autoComplete="one-time-code"
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Войти
              </Button>
            </Form.Item>
            <Button
              type="link"
              onClick={() => {
                setStep('phone');
                setPhoneNormalized(null);
              }}
            >
              Назад
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
