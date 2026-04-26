import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { normalizeKzPhone } from '@bilimland/shared';
import { api, setTokens } from '../api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
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
    <div className="pg-login">
      <div className="pg-login__brand" aria-hidden={false}>
        <div className="pg-login__mark">M</div>
        <h1 className="pg-login__title">MyTest</h1>
        <p className="pg-login__tagline">Панель администратора</p>
        <ul className="pg-login__bullets">
          <li>Вход по номеру, как в Telegram-боте — без отдельного пароля</li>
          <li>Одноразовый код уходит в привязанный Telegram</li>
          <li>Роль admin проверяется на сервере при входе</li>
        </ul>
      </div>

      <div className="pg-login__stage">
        <div className="pg-login__panel">
          <div className="pg-login__steps" aria-label="Шаги входа">
            <span className={step === 'phone' ? 'is-active' : 'is-done'}>1. Телефон</span>
            <span aria-hidden>→</span>
            <span className={step === 'code' ? 'is-active' : ''}>2. Код</span>
          </div>

          {step === 'phone' ? (
            <>
              <h2 className="pg-login__head">Войти</h2>
              <p className="pg-login__sub">Укажите номер в формате KZ. Мы пришлём код в Telegram.</p>
              <Form onFinish={handleRequestCode} layout="vertical" requiredMark="optional">
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
            </>
          ) : (
            <>
              <h2 className="pg-login__head">Код из Telegram</h2>
              <p className="pg-login__code-hint">
                Отправлен на{' '}
                <strong>{phoneNormalized ? `+${phoneNormalized}` : phone}</strong>
              </p>
              <Form onFinish={handleVerifyCode} layout="vertical">
                <Form.Item
                  name="code"
                  label="6 цифр"
                  rules={[{ required: true, len: 6, message: 'Введите 6-значный код' }]}
                >
                  <Input
                    size="large"
                    maxLength={6}
                    style={{ textAlign: 'center', letterSpacing: 10, fontSize: 22, fontWeight: 600 }}
                    autoComplete="one-time-code"
                    placeholder="••••••"
                  />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                    Войти в панель
                  </Button>
                </Form.Item>
                <div className="pg-login__back">
                  <Button
                    type="link"
                    onClick={() => {
                      setStep('phone');
                      setPhoneNormalized(null);
                    }}
                  >
                    Изменить номер
                  </Button>
                </div>
              </Form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
