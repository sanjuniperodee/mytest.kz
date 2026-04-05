import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { api, setTokens } from '../api/client';

const { Title } = Typography;

export function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'username' | 'code'>('username');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    setLoading(true);
    try {
      await api.post('/auth/web/request-code', { username });
      setStep('code');
      message.success('Код отправлен в Telegram');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (values: { code: string }) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/web/verify-code', {
        username,
        code: values.code,
      });

      if (!data.user.isAdmin) {
        message.error('У вас нет прав администратора');
        return;
      }

      setTokens(data.accessToken, data.refreshToken);
      navigate('/');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(180deg,#f5f7fb,#eef3fb)' }}>
      <Card style={{ width: 420, borderRadius: 12, boxShadow: '0 10px 30px rgba(15,23,42,0.08)' }}>
        <Title level={3} style={{ textAlign: 'center' }}>BilimLand Admin</Title>
        <p style={{ textAlign: 'center', color: '#64748b', marginTop: -8, marginBottom: 20 }}>
          Вход только для администраторов
        </p>

        {step === 'username' ? (
          <Form onFinish={handleRequestCode} layout="vertical">
            <Form.Item label="Telegram username" required>
              <Input
                prefix="@"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace('@', ''))}
                placeholder="username"
                size="large"
                autoFocus
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
            <p style={{ marginBottom: 16, color: '#666' }}>
              Код отправлен в Telegram @{username}
            </p>
            <Form.Item name="code" label="Код" rules={[{ required: true, len: 6, message: 'Введите 6-значный код' }]}>
              <Input size="large" maxLength={6} style={{ textAlign: 'center', letterSpacing: 8, fontSize: 24 }} autoComplete="one-time-code" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Войти
              </Button>
            </Form.Item>
            <Button type="link" onClick={() => setStep('username')}>
              Назад
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
