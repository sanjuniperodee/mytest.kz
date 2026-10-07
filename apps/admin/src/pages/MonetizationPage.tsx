import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Popconfirm,
  Skeleton,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckOutlined,
  CrownOutlined,
  DeleteOutlined,
  EditOutlined,
  GiftOutlined,
  NotificationOutlined,
  PlusOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  AD_PLACEMENT_KEYS,
  AD_PLACEMENT_LABELS,
  FREE_DAILY_ATTEMPTS_MAX,
  PREMIUM_FEATURE_KEYS,
  PREMIUM_FEATURE_LABELS,
  freeDailyEntAttempts,
  validateMonetizationConfig,
  validateMonetizationPlan,
  type LocalizedText,
  type MonetizationConfig,
  type MonetizationPlan,
  type MonetizationValidationError,
} from '@bilimland/shared';
import { api } from '../api/client';
import { AdminPageShell } from '../components/AdminPageShell';
import { PageHero } from '../components/PageHero';
import './monetization.css';

type PlanUsage = { activeSubscriptions: number; paidOrders: number; revenueKzt: number };
type AdminMonetizationResponse = {
  config: MonetizationConfig;
  usage: Record<string, PlanUsage>;
};

const QUERY_KEY = ['admin-monetization'];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function formatKzt(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₸`;
}

function formatSavedAt(iso: string | null): string {
  if (!iso) return 'ещё не сохранялось — действуют настройки по умолчанию';
  return `сохранено ${new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** «Объяснения к вопросам» → «объяснения к вопросам», но «AI-разбор» остаётся «AI-разбор». */
function lowerFirst(text: string): string {
  return /^[A-Z]{2}/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function attemptsLabel(plan: Pick<MonetizationPlan, 'attemptsLimit' | 'dailyLimit'>): string {
  const total = plan.attemptsLimit == null ? 'безлимит ЕНТ' : `${plan.attemptsLimit} ЕНТ`;
  return plan.dailyLimit == null ? total : `${total} · до ${plan.dailyLimit} в день`;
}

function apiErrors(e: unknown): { message: string; fieldErrors: MonetizationValidationError[] } {
  if (isAxiosError(e)) {
    const body = e.response?.data as
      | { code?: string; message?: string; errors?: MonetizationValidationError[] }
      | undefined;
    if (body?.code === 'MONETIZATION_STALE') {
      return {
        message: 'Настройки успели изменить в другой вкладке или другой админ. Обновите страницу.',
        fieldErrors: [],
      };
    }
    if (Array.isArray(body?.errors)) {
      return { message: 'Исправьте ошибки в настройках', fieldErrors: body.errors };
    }
    if (typeof body?.message === 'string') return { message: body.message, fieldErrors: [] };
  }
  return { message: 'Не удалось сохранить настройки', fieldErrors: [] };
}

function emptyPlan(existing: MonetizationPlan[]): MonetizationPlan {
  let n = existing.length + 1;
  while (existing.some((p) => p.code === `plan${n}`)) n += 1;
  return {
    code: `plan${n}`,
    name: { ru: '', kk: '' },
    description: { ru: '', kk: '' },
    priceKzt: 990,
    originalPriceKzt: null,
    durationDays: 30,
    attemptsLimit: 3,
    dailyLimit: null,
    features: [
      { ru: 'AI-разбор ошибок', kk: 'Қателерді AI-талдау' },
      { ru: 'Без рекламы', kk: 'Жарнамасыз' },
    ],
    badge: null,
    isActive: true,
  };
}

/** Небольшая подпись ошибки под полем. */
function FieldError({ text }: { text?: string }) {
  return text ? <div className="pg-money__field-error">{text}</div> : null;
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="pg-money__field" role="group" aria-label={label}>
      <span className="pg-money__field-label">{label}</span>
      {children}
      {hint ? <span className="pg-money__field-hint">{hint}</span> : null}
      <FieldError text={error} />
    </div>
  );
}

function LocalizedInput({
  value,
  onChange,
  placeholder,
  textarea,
}: {
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  const Comp = textarea ? Input.TextArea : Input;
  return (
    <div className="pg-money__i18n">
      <Comp
        addonBefore={textarea ? undefined : 'RU'}
        placeholder={placeholder ? `${placeholder} (рус.)` : 'Русский'}
        value={value.ru}
        rows={textarea ? 2 : undefined}
        onChange={(e) => onChange({ ...value, ru: e.target.value })}
      />
      <Comp
        addonBefore={textarea ? undefined : 'KZ'}
        placeholder="Қазақша (пусто — покажем русский)"
        value={value.kk}
        rows={textarea ? 2 : undefined}
        onChange={(e) => onChange({ ...value, kk: e.target.value })}
      />
    </div>
  );
}

/** Карточка тарифа так, как её увидит ученик на странице оплаты. */
function PlanPreview({ plan }: { plan: MonetizationPlan }) {
  return (
    <div className={`pg-money-preview${plan.badge?.ru ? ' pg-money-preview--hl' : ''}`}>
      {plan.badge?.ru ? <span className="pg-money-preview__badge">{plan.badge.ru}</span> : null}
      <div className="pg-money-preview__name">{plan.name.ru || 'Название тарифа'}</div>
      <div className="pg-money-preview__price">
        {formatKzt(plan.priceKzt || 0)}
        {plan.originalPriceKzt ? (
          <span className="pg-money-preview__old">{formatKzt(plan.originalPriceKzt)}</span>
        ) : null}
      </div>
      <div className="pg-money-preview__meta">
        {attemptsLabel(plan)} · {plan.durationDays} дн.
      </div>
      {plan.description.ru ? <p className="pg-money-preview__desc">{plan.description.ru}</p> : null}
      <ul className="pg-money-preview__features">
        {plan.features.filter((f) => f.ru).map((f, i) => (
          <li key={i}>
            <CheckOutlined /> {f.ru}
          </li>
        ))}
      </ul>
      <div className="pg-money-preview__cta">Купить</div>
    </div>
  );
}

function PlanEditor({
  open,
  plan,
  codeLocked,
  errors,
  onClose,
  onApply,
}: {
  open: boolean;
  plan: MonetizationPlan | null;
  codeLocked: boolean;
  errors: (path: string) => string | undefined;
  onClose: () => void;
  onApply: (plan: MonetizationPlan) => void;
}) {
  const [value, setValue] = useState<MonetizationPlan | null>(plan);
  useEffect(() => setValue(plan ? clone(plan) : null), [plan]);
  if (!value) return null;

  const set = <K extends keyof MonetizationPlan>(key: K, next: MonetizationPlan[K]) =>
    setValue((prev) => (prev ? { ...prev, [key]: next } : prev));
  const localErrors = validateMonetizationPlan(value);
  const err = (field: string) =>
    localErrors.find((e) => e.path === field)?.message ?? errors(field);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={980}
      title={codeLocked ? `Тариф «${value.name.ru || value.code}»` : 'Новый тариф'}
      extra={
        <Space>
          <Button onClick={onClose}>Отмена</Button>
          <Button
            type="primary"
            disabled={localErrors.length > 0}
            onClick={() => onApply(value)}
          >
            Применить
          </Button>
        </Space>
      }
    >
      <div className="pg-money-editor">
        <div className="pg-money-editor__form">
          <div className="pg-money__grid-2">
            <Field
              label="Код тарифа"
              hint={
                codeLocked
                  ? 'Код записан в заказах и подписках — менять нельзя.'
                  : 'Латиница, цифры, «_» и «-». После первой продажи не меняется.'
              }
              error={err('code')}
            >
              <Input
                value={value.code}
                disabled={codeLocked}
                onChange={(e) => set('code', e.target.value.trim().toLowerCase())}
              />
            </Field>
            <Field label="В продаже">
              <Space>
                <Switch checked={value.isActive} onChange={(v) => set('isActive', v)} />
                <Typography.Text type="secondary">
                  {value.isActive ? 'Виден на странице тарифов' : 'Скрыт; у купивших продолжает работать'}
                </Typography.Text>
              </Space>
            </Field>
          </div>

          <Field label="Название" error={err('name')}>
            <LocalizedInput value={value.name} onChange={(v) => set('name', v)} placeholder="3 пробных" />
          </Field>
          <Field label="Описание">
            <LocalizedInput value={value.description} onChange={(v) => set('description', v)} textarea />
          </Field>

          <div className="pg-money__grid-3">
            <Field label="Цена, ₸" error={err('priceKzt')}>
              <InputNumber
                min={1}
                max={1_000_000}
                step={10}
                style={{ width: '100%' }}
                value={value.priceKzt}
                onChange={(v) => set('priceKzt', Number(v ?? 0))}
              />
            </Field>
            <Field label="Старая цена, ₸" hint="Зачёркнутая. Пусто — не показывать." error={err('originalPriceKzt')}>
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                value={value.originalPriceKzt ?? undefined}
                onChange={(v) => set('originalPriceKzt', v == null || v === 0 ? null : Number(v))}
              />
            </Field>
            <Field label="Срок, дней" error={err('durationDays')}>
              <InputNumber
                min={1}
                max={3650}
                style={{ width: '100%' }}
                value={value.durationDays}
                onChange={(v) => set('durationDays', Number(v ?? 1))}
              />
            </Field>
          </div>

          <div className="pg-money__grid-2">
            <Field
              label="Пробных ЕНТ за срок"
              hint="Сверх бесплатных. Списываются раньше бесплатной попытки дня."
              error={err('attemptsLimit')}
            >
              <InputNumber
                min={1}
                style={{ width: '100%' }}
                disabled={value.attemptsLimit == null}
                value={value.attemptsLimit ?? undefined}
                onChange={(v) => set('attemptsLimit', Number(v ?? 1))}
              />
              <Checkbox
                checked={value.attemptsLimit == null}
                onChange={(e) => set('attemptsLimit', e.target.checked ? null : 3)}
              >
                Безлимит
              </Checkbox>
            </Field>
            <Field label="Платных попыток в день" error={err('dailyLimit')}>
              <InputNumber
                min={1}
                style={{ width: '100%' }}
                disabled={value.dailyLimit == null}
                value={value.dailyLimit ?? undefined}
                onChange={(v) => set('dailyLimit', Number(v ?? 1))}
              />
              <Checkbox
                checked={value.dailyLimit == null}
                onChange={(e) => set('dailyLimit', e.target.checked ? null : 1)}
              >
                Без дневного лимита
              </Checkbox>
            </Field>
          </div>

          <Field label="Бейдж на карточке" hint="Например «популярно». Пусто — без бейджа.">
            <LocalizedInput
              value={value.badge ?? { ru: '', kk: '' }}
              onChange={(v) => set('badge', v.ru || v.kk ? v : null)}
            />
          </Field>

          <Field label="Что входит (пункты списка)">
            <div className="pg-money__features">
              {value.features.map((feature, i) => (
                <div key={i} className="pg-money__feature-row">
                  <LocalizedInput
                    value={feature}
                    onChange={(v) =>
                      set(
                        'features',
                        value.features.map((f, j) => (j === i ? v : f)),
                      )
                    }
                  />
                  <Button
                    aria-label="Удалить пункт"
                    icon={<DeleteOutlined />}
                    onClick={() => set('features', value.features.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
              {value.features.length < 10 ? (
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => set('features', [...value.features, { ru: '', kk: '' }])}
                >
                  Добавить пункт
                </Button>
              ) : null}
            </div>
          </Field>
        </div>
        <aside className="pg-money-editor__preview">
          <Typography.Text type="secondary">Так увидит ученик</Typography.Text>
          <PlanPreview plan={value} />
        </aside>
      </div>
    </Drawer>
  );
}

export function MonetizationPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await api.get<AdminMonetizationResponse>('/admin/monetization')).data,
  });

  const [draft, setDraft] = useState<MonetizationConfig | null>(null);
  const [serverErrors, setServerErrors] = useState<MonetizationValidationError[]>([]);
  const [editing, setEditing] = useState<{ index: number | null; plan: MonetizationPlan } | null>(null);

  useEffect(() => {
    if (data && !draft) setDraft(clone(data.config));
  }, [data, draft]);

  const saved = data?.config ?? null;
  const dirty = useMemo(
    () => Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved)),
    [draft, saved],
  );
  const errors = useMemo(
    () => (draft ? [...validateMonetizationConfig(draft), ...serverErrors] : []),
    [draft, serverErrors],
  );
  const errorAt = (path: string) => errors.find((e) => e.path === path)?.message;
  const savedCodes = useMemo(() => new Set(saved?.plans.map((p) => p.code) ?? []), [saved]);

  const save = useMutation({
    mutationFn: async (config: MonetizationConfig) =>
      (await api.put<MonetizationConfig>('/admin/monetization', config)).data,
    onSuccess: (next) => {
      setServerErrors([]);
      setDraft(clone(next));
      queryClient.setQueryData<AdminMonetizationResponse>(QUERY_KEY, (prev) =>
        prev ? { ...prev, config: next } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      message.success('Сохранено. Сайт и приложение подхватят изменения в течение 15 секунд.');
    },
    onError: (e) => {
      const { message: text, fieldErrors } = apiErrors(e);
      setServerErrors(fieldErrors);
      message.error(text);
    },
  });

  if (isError) {
    return (
      <AdminPageShell wide>
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить настройки тарифов"
          action={<Button onClick={() => void refetch()}>Повторить</Button>}
        />
      </AdminPageShell>
    );
  }

  if (isPending || !draft || !saved) {
    return (
      <AdminPageShell wide>
        <Skeleton active paragraph={{ rows: 12 }} />
      </AdminPageShell>
    );
  }

  const update = (fn: (cfg: MonetizationConfig) => MonetizationConfig) => {
    setServerErrors([]);
    setDraft((prev) => (prev ? fn(clone(prev)) : prev));
  };
  const usage = (code: string): PlanUsage =>
    data?.usage[code] ?? { activeSubscriptions: 0, paidOrders: 0, revenueKzt: 0 };

  const freeDaily = freeDailyEntAttempts(draft);
  const plansOnSale = draft.plans.filter((p) => p.isActive);
  const cheapest = plansOnSale.length ? Math.min(...plansOnSale.map((p) => p.priceKzt)) : null;
  const paidFeatures = PREMIUM_FEATURE_KEYS.filter((key) => draft.premiumFeatures[key]);
  const liveAdSlots = AD_PLACEMENT_KEYS.filter((key) => draft.ads.slots[key]);
  const adsLive = draft.ads.enabled && Boolean(draft.ads.adsenseClientId) && liveAdSlots.length > 0;

  const movePlan = (index: number, delta: number) =>
    update((cfg) => {
      const target = index + delta;
      if (target < 0 || target >= cfg.plans.length) return cfg;
      [cfg.plans[index], cfg.plans[target]] = [cfg.plans[target], cfg.plans[index]];
      return cfg;
    });

  return (
    <AdminPageShell wide>
      <div className="pg-money">
        <PageHero
          eyebrowIcon={<CrownOutlined />}
          eyebrow="Монетизация"
          title="Тарифы и доступ"
          lede="Единое место, где решается, что бесплатно, что за подписку, сколько это стоит и где показывается реклама. Сайт, мобильное приложение и оплата берут настройки отсюда."
          aside={
            <span className={dirty ? 'pg-dash__pill pg-dash__pill--sync' : 'pg-dash__pill'}>
              {dirty ? (
                <>
                  <ThunderboltOutlined /> Есть несохранённые изменения
                </>
              ) : (
                formatSavedAt(saved.updatedAt)
              )}
            </span>
          }
        />

        <section className="pg-money__flow" aria-label="Как сейчас работает доступ">
          <div className="pg-money__flow-card pg-money__flow-card--free">
            <GiftOutlined className="pg-money__flow-icon" />
            <div className="pg-money__flow-k">Бесплатно каждому</div>
            <div className="pg-money__flow-v">
              {freeDaily > 0 ? `${freeDaily} ЕНТ в день` : 'выключено'}
            </div>
            <p>Сброс в полночь по часовому поясу ученика. Бесплатный тест — «тест дня», общий для всех.</p>
          </div>
          <div className="pg-money__flow-arrow" aria-hidden>
            →
          </div>
          <div className="pg-money__flow-card pg-money__flow-card--limit">
            <WarningOutlined className="pg-money__flow-icon" />
            <div className="pg-money__flow-k">Попытки кончились</div>
            <div className="pg-money__flow-v">Окно «подожди или оплати»</div>
            <p>С таймером до следующей бесплатной попытки и кнопкой подписки.</p>
          </div>
          <div className="pg-money__flow-arrow" aria-hidden>
            →
          </div>
          <div className="pg-money__flow-card pg-money__flow-card--paid">
            <CrownOutlined className="pg-money__flow-icon" />
            <div className="pg-money__flow-k">Подписка</div>
            <div className="pg-money__flow-v">
              {plansOnSale.length} {pluralRu(plansOnSale.length, 'тариф', 'тарифа', 'тарифов')}
              {cheapest != null ? `, от ${formatKzt(cheapest)}` : ''}
            </div>
            <p>
              Открывает:{' '}
              {paidFeatures.length
                ? paidFeatures.map((k) => lowerFirst(PREMIUM_FEATURE_LABELS[k].title)).join(', ')
                : 'дополнительные попытки'}
              . Платные попытки списываются первыми.
            </p>
          </div>
          <div className="pg-money__flow-card pg-money__flow-card--ads">
            <NotificationOutlined className="pg-money__flow-icon" />
            <div className="pg-money__flow-k">Реклама</div>
            <div className="pg-money__flow-v">
              {adsLive
                ? `${liveAdSlots.length} ${pluralRu(liveAdSlots.length, 'место', 'места', 'мест')}`
                : 'не показывается'}
            </div>
            <p>
              {adsLive && draft.ads.hideForPremium
                ? 'Подписчики рекламу не видят.'
                : adsLive
                  ? 'Видят все, включая подписчиков.'
                  : 'Нужен AdSense publisher id и ID блоков.'}
            </p>
          </div>
        </section>

        {errors.length > 0 ? (
          <Alert
            type="error"
            showIcon
            message="Сохранить пока нельзя"
            description={
              <ul className="pg-money__error-list">
                {errors.map((e, i) => (
                  <li key={`${e.path}-${i}`}>{e.message}</li>
                ))}
              </ul>
            }
          />
        ) : null}

        <div className="pg-money__columns">
          <section className="pg-money__panel">
            <header className="pg-money__panel-head">
              <h2>
                <GiftOutlined /> Бесплатный доступ
              </h2>
              <p>Сколько полных пробных ЕНТ в день ученик проходит без оплаты.</p>
            </header>
            <div className="pg-money__row">
              <div>
                <div className="pg-money__row-title">Бесплатные пробные ЕНТ</div>
                <div className="pg-money__row-desc">
                  Выключите, чтобы ЕНТ проходили только по подписке.
                </div>
              </div>
              <Switch
                checked={draft.freeTier.enabled}
                onChange={(v) => update((cfg) => ({ ...cfg, freeTier: { ...cfg.freeTier, enabled: v } }))}
              />
            </div>
            <div className="pg-money__row">
              <div>
                <div className="pg-money__row-title">ЕНТ в день</div>
                <div className="pg-money__row-desc">
                  Обновляется в 00:00 по часовому поясу ученика (по умолчанию Алматы).
                </div>
                <FieldError text={errorAt('freeTier.dailyEntAttempts')} />
              </div>
              <InputNumber
                min={0}
                max={FREE_DAILY_ATTEMPTS_MAX}
                disabled={!draft.freeTier.enabled}
                value={draft.freeTier.dailyEntAttempts}
                onChange={(v) =>
                  update((cfg) => ({
                    ...cfg,
                    freeTier: { ...cfg.freeTier, dailyEntAttempts: Number(v ?? 0) },
                  }))
                }
              />
            </div>
          </section>

          <section className="pg-money__panel">
            <header className="pg-money__panel-head">
              <h2>
                <CrownOutlined /> Что открывает подписка
              </h2>
              <p>Включено — функция доступна только с активной подпиской.</p>
            </header>
            {PREMIUM_FEATURE_KEYS.map((key) => (
              <div key={key} className="pg-money__row">
                <div>
                  <div className="pg-money__row-title">
                    {key === 'aiCoach' ? <RobotOutlined /> : null} {PREMIUM_FEATURE_LABELS[key].title}
                    {key === 'aiCoach' && !draft.premiumFeatures.aiCoach ? (
                      <Tooltip title="Каждый AI-разбор стоит денег (DeepSeek). Бесплатно для всех — расходы вырастут.">
                        <Tag color="orange" style={{ marginLeft: 8 }}>
                          расход AI-бюджета
                        </Tag>
                      </Tooltip>
                    ) : null}
                  </div>
                  <div className="pg-money__row-desc">{PREMIUM_FEATURE_LABELS[key].description}</div>
                </div>
                <Space size={8} className="pg-money__switch">
                  <span className={draft.premiumFeatures[key] ? 'pg-money__switch-on' : undefined}>
                    {draft.premiumFeatures[key] ? 'Premium' : 'Бесплатно'}
                  </span>
                  <Switch
                    aria-label={`${PREMIUM_FEATURE_LABELS[key].title}: только по подписке`}
                    checked={draft.premiumFeatures[key]}
                    onChange={(v) =>
                      update((cfg) => ({
                        ...cfg,
                        premiumFeatures: { ...cfg.premiumFeatures, [key]: v },
                      }))
                    }
                  />
                </Space>
              </div>
            ))}
          </section>
        </div>

        <section className="pg-money__panel">
          <header className="pg-money__panel-head pg-money__panel-head--row">
            <div>
              <h2>
                <CrownOutlined /> Тарифы
              </h2>
              <p>
                Порядок здесь = порядок на странице оплаты. Изменения цен и лимитов действуют для новых
                покупок — у уже купивших сохраняются условия на момент оплаты.
              </p>
            </div>
            <Button
              icon={<PlusOutlined />}
              disabled={draft.plans.length >= 12}
              onClick={() => setEditing({ index: null, plan: emptyPlan(draft.plans) })}
            >
              Добавить тариф
            </Button>
          </header>
          {draft.plans.length === 0 ? (
            <Empty description="Нет тарифов" />
          ) : (
            <div className="pg-money__plans">
              {draft.plans.map((plan, index) => {
                const stats = usage(plan.code);
                const isNew = !savedCodes.has(plan.code);
                const sold = stats.paidOrders > 0 || stats.activeSubscriptions > 0;
                return (
                  <article
                    key={plan.code}
                    className={`pg-money-plan${plan.isActive ? '' : ' pg-money-plan--off'}`}
                  >
                    <div className="pg-money-plan__main">
                      <div className="pg-money-plan__title">
                        {plan.name.ru || plan.code}
                        {plan.badge?.ru ? <Tag color="blue">{plan.badge.ru}</Tag> : null}
                        {plan.isActive ? (
                          <Tag color="green">в продаже</Tag>
                        ) : (
                          <Tag>снят с продажи</Tag>
                        )}
                        {isNew ? <Tag color="gold">новый</Tag> : null}
                      </div>
                      <div className="pg-money-plan__terms">
                        <strong>{formatKzt(plan.priceKzt)}</strong>
                        {plan.originalPriceKzt ? <s>{formatKzt(plan.originalPriceKzt)}</s> : null}
                        <span>· {attemptsLabel(plan)}</span>
                        <span>· {plan.durationDays} дн.</span>
                        <code>{plan.code}</code>
                      </div>
                      <div className="pg-money-plan__stats">
                        Активных подписок: {stats.activeSubscriptions} · Оплат: {stats.paidOrders} · Выручка:{' '}
                        {formatKzt(stats.revenueKzt)}
                      </div>
                      {errors.some((e) => e.path.startsWith(`plans.${index}.`)) ? (
                        <FieldError text="В тарифе есть ошибки — откройте и исправьте" />
                      ) : null}
                    </div>
                    <div className="pg-money-plan__actions">
                      <Tooltip title={plan.isActive ? 'Снять с продажи' : 'Вернуть в продажу'}>
                        <Switch
                          size="small"
                          checked={plan.isActive}
                          onChange={(v) =>
                            update((cfg) => {
                              cfg.plans[index].isActive = v;
                              return cfg;
                            })
                          }
                        />
                      </Tooltip>
                      <Button
                        size="small"
                        aria-label="Выше"
                        icon={<ArrowUpOutlined />}
                        disabled={index === 0}
                        onClick={() => movePlan(index, -1)}
                      />
                      <Button
                        size="small"
                        aria-label="Ниже"
                        icon={<ArrowDownOutlined />}
                        disabled={index === draft.plans.length - 1}
                        onClick={() => movePlan(index, 1)}
                      />
                      <Button size="small" icon={<EditOutlined />} onClick={() => setEditing({ index, plan })}>
                        Изменить
                      </Button>
                      {sold ? (
                        <Tooltip title="Тариф уже покупали — его можно только снять с продажи">
                          <Button size="small" icon={<DeleteOutlined />} disabled />
                        </Tooltip>
                      ) : (
                        <Popconfirm
                          title="Удалить тариф?"
                          okText="Удалить"
                          cancelText="Отмена"
                          onConfirm={() =>
                            update((cfg) => ({ ...cfg, plans: cfg.plans.filter((_, j) => j !== index) }))
                          }
                        >
                          <Button size="small" danger aria-label="Удалить" icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <FieldError text={errorAt('plans')} />
        </section>

        <section className="pg-money__panel">
          <header className="pg-money__panel-head">
            <h2>
              <NotificationOutlined /> Реклама Google AdSense
            </h2>
            <p>
              Аккуратные адаптивные блоки с подписью «Реклама»: только вне теста — никогда во время прохождения
              ЕНТ и не во всплывающих окнах (это запрещено правилами AdSense).
            </p>
          </header>
          <div className="pg-money__row">
            <div>
              <div className="pg-money__row-title">Показывать рекламу</div>
              <div className="pg-money__row-desc">Скрипт AdSense грузится лениво и не тормозит первый экран.</div>
            </div>
            <Switch
              checked={draft.ads.enabled}
              onChange={(v) => update((cfg) => ({ ...cfg, ads: { ...cfg.ads, enabled: v } }))}
            />
          </div>
          <div className="pg-money__row">
            <div>
              <div className="pg-money__row-title">Скрывать рекламу у подписчиков</div>
              <div className="pg-money__row-desc">«Без рекламы» — ещё одна причина купить подписку.</div>
            </div>
            <Switch
              checked={draft.ads.hideForPremium}
              onChange={(v) => update((cfg) => ({ ...cfg, ads: { ...cfg.ads, hideForPremium: v } }))}
            />
          </div>
          <div className="pg-money__grid-2 pg-money__ads-grid">
            <Field
              label="AdSense publisher id"
              hint="Из кабинета AdSense: Аккаунт → Сведения. По нему же автоматически публикуется /ads.txt."
              error={errorAt('ads.adsenseClientId')}
            >
              <Input
                placeholder="ca-pub-0000000000000000"
                value={draft.ads.adsenseClientId}
                onChange={(e) =>
                  update((cfg) => ({ ...cfg, ads: { ...cfg.ads, adsenseClientId: e.target.value.trim() } }))
                }
              />
            </Field>
            {AD_PLACEMENT_KEYS.map((key) => (
              <Field
                key={key}
                label={`Блок: ${AD_PLACEMENT_LABELS[key].title}`}
                hint={`${AD_PLACEMENT_LABELS[key].description} Пусто — место выключено.`}
                error={errorAt(`ads.slots.${key}`)}
              >
                <Input
                  placeholder="data-ad-slot, например 1234567890"
                  value={draft.ads.slots[key]}
                  onChange={(e) =>
                    update((cfg) => ({
                      ...cfg,
                      ads: { ...cfg.ads, slots: { ...cfg.ads.slots, [key]: e.target.value.trim() } },
                    }))
                  }
                />
              </Field>
            ))}
          </div>
          <Alert
            type="info"
            showIcon
            message="Как подключить"
            description={
              <ol className="pg-money__steps">
                <li>Добавьте сайт my-test.kz в AdSense и дождитесь одобрения.</li>
                <li>Вставьте publisher id сюда и сохраните — /ads.txt опубликуется сам.</li>
                <li>В AdSense создайте медийные адаптивные блоки (Display) и вставьте их ID в нужные места.</li>
                <li>
                  «Автоматические объявления» в кабинете AdSense лучше оставить выключенными — тогда реклама будет
                  только в выбранных местах и не помешает ученикам.
                </li>
              </ol>
            }
          />
        </section>

        <div className={`pg-money__savebar${dirty ? ' pg-money__savebar--visible' : ''}`}>
          <span>{errors.length ? 'Исправьте ошибки, чтобы сохранить' : 'Есть несохранённые изменения'}</span>
          <Space>
            <Button
              disabled={!dirty || save.isPending}
              onClick={() => {
                setServerErrors([]);
                setDraft(clone(saved));
              }}
            >
              Отменить
            </Button>
            <Button
              type="primary"
              loading={save.isPending}
              disabled={!dirty || errors.length > 0}
              onClick={() => save.mutate(draft)}
            >
              Сохранить
            </Button>
          </Space>
        </div>
      </div>

      <PlanEditor
        open={editing != null}
        plan={editing?.plan ?? null}
        codeLocked={editing != null && savedCodes.has(editing.plan.code)}
        errors={(field) =>
          editing?.index != null ? errorAt(`plans.${editing.index}.${field}`) : undefined
        }
        onClose={() => setEditing(null)}
        onApply={(plan) => {
          const index = editing?.index ?? null;
          if (draft.plans.some((p, j) => p.code === plan.code && j !== index)) {
            message.error(`Код «${plan.code}» уже есть у другого тарифа`);
            return;
          }
          update((cfg) => {
            if (index == null) cfg.plans.push(plan);
            else cfg.plans[index] = plan;
            return cfg;
          });
          setEditing(null);
        }}
      />
    </AdminPageShell>
  );
}
