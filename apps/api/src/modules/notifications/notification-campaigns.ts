export type NotificationCampaignKey =
  | 'welcome'
  | 'result_recap'
  | 'community_reply'
  | 'abandoned_test'
  | 'free_ent_available'
  | 'channel_gate_day1'
  | 'channel_gate_day3'
  | 'no_trial_day1'
  | 'no_trial_day3'
  | 'post_trial_no_payment'
  | 'post_trial_day1_no_payment'
  | 'post_trial_day3_no_payment'
  | 'paid_expiring_soon'
  | 'paid_weekly_inactive';

/** Delivery channels. The array order is the preference order when a user has several. */
export type NotificationChannel = 'push' | 'telegram' | 'email';
export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = ['push', 'telegram', 'email'];
const ALL_CHANNELS = NOTIFICATION_CHANNELS;

export interface NotificationMessage {
  ru: string;
  kk: string;
}

export interface NotificationCampaignDefinition {
  key: NotificationCampaignKey;
  title: string;
  cooldownHours: number;
  channelButtons?: boolean;
  /** Telegram text; also the body of push/email unless the campaign renders its own. */
  message: NotificationMessage;
  /** Push title and email subject/heading. */
  headline: NotificationMessage;
  /** Button label in email/push. */
  cta: NotificationMessage;
  /** Site path the notification opens (relative to PUBLIC_SITE_URL). */
  path: string;
  /** Channels this campaign may use. */
  channels: readonly NotificationChannel[];
  /** How many channels to use for one user per run (default 1: the preferred one). */
  maxChannels?: number;
  /** Reaction to the user's own action (signup, finished test, reply): not blocked by the 24h cross-campaign cooldown. */
  bypassGlobalCooldown?: boolean;
  /** At most `max` sent deliveries of this campaign per user within `windowHours`. */
  frequencyCap?: { max: number; windowHours: number };
  /** Not sent while this (newer) campaign is active — one message per event, not two. */
  supersededBy?: NotificationCampaignKey;
  /** isActive of the row created on first start. New campaigns start off: enable them in admin «Рассылки». */
  defaultActive?: boolean;
}

/** Processing order of a run = this order (event-driven messages first). */
export const NOTIFICATION_CAMPAIGNS: readonly NotificationCampaignDefinition[] = [
  {
    key: 'welcome',
    title: 'Приветствие: что сделать первым',
    cooldownHours: 24,
    channels: ALL_CHANNELS,
    defaultActive: false,
    bypassGlobalCooldown: true,
    path: '/dashboard/exams',
    headline: {
      ru: 'Добро пожаловать в mytest',
      kk: 'mytest-ке қош келдіңіз',
    },
    cta: { ru: 'Пройти бесплатный ЕНТ', kk: 'Тегін ҰБТ тапсыру' },
    message: {
      ru: 'Начните с бесплатного пробного ЕНТ: реальный формат, балл сразу после завершения и разбор ответов. Так вы за один вечер поймёте, сколько баллов уже есть и где их теряете.',
      kk: 'Тегін сынақ ҰБТ-дан бастаңыз: нақты формат, аяқтаған соң бірден балл және жауаптар талдауы. Бір кеште қанша балыңыз бар екенін және оны қай жерде жоғалтатыныңызды білесіз.',
    },
  },
  {
    key: 'result_recap',
    title: 'Итог ЕНТ: балл и где потеряны баллы',
    cooldownHours: 24,
    channels: ALL_CHANNELS,
    defaultActive: false,
    bypassGlobalCooldown: true,
    frequencyCap: { max: 1, windowHours: 12 },
    path: '/dashboard/history',
    headline: { ru: 'Ваш результат ЕНТ', kk: 'ҰБТ нәтижеңіз' },
    cta: { ru: 'Открыть разбор', kk: 'Талдауды ашу' },
    // Rendered from the session (score + subjects); this is the fallback text.
    message: {
      ru: 'Результат пробного ЕНТ готов. Откройте разбор: там видно, в каких предметах вы потеряли больше всего баллов.',
      kk: 'Сынақ ҰБТ нәтижесі дайын. Талдауды ашыңыз: қай пәндерде көп балл жоғалтқаныңыз көрінеді.',
    },
  },
  {
    key: 'community_reply',
    title: 'Ответили в сообществе',
    cooldownHours: 24,
    channels: ALL_CHANNELS,
    defaultActive: false,
    bypassGlobalCooldown: true,
    frequencyCap: { max: 1, windowHours: 24 },
    path: '/dashboard/community',
    headline: { ru: 'Вам ответили в сообществе', kk: 'Сізге қауымдастықта жауап берді' },
    cta: { ru: 'Посмотреть ответ', kk: 'Жауапты көру' },
    message: {
      ru: 'На ваш пост в сообществе mytest пришёл ответ.',
      kk: 'mytest қауымдастығындағы жазбаңызға жауап келді.',
    },
  },
  {
    key: 'abandoned_test',
    title: 'Начал тест, но не завершил',
    cooldownHours: 24,
    channels: ALL_CHANNELS,
    path: '/dashboard/history',
    headline: { ru: 'Пробный тест не завершён', kk: 'Сынақ тест аяқталмады' },
    cta: { ru: 'Вернуться к тесту', kk: 'Тестке оралу' },
    message: {
      ru: 'Вы начали пробный тест, но не завершили его. Вернитесь, чтобы увидеть результат и понять, какие темы стоит подтянуть.',
      kk: 'Сіз сынақ тестін бастап, аяқтамадыңыз. Нәтижеңізді көріп, қай тақырыптарды қайталау керек екенін білу үшін қайта кіріңіз.',
    },
  },
  {
    key: 'free_ent_available',
    title: 'Бесплатный ЕНТ на сегодня снова доступен',
    cooldownHours: 24,
    channels: ALL_CHANNELS,
    defaultActive: false,
    frequencyCap: { max: 2, windowHours: 168 },
    path: '/dashboard/exams',
    headline: {
      ru: 'Бесплатный ЕНТ на сегодня снова доступен',
      kk: 'Бүгінгі тегін ҰБТ қайта қолжетімді',
    },
    cta: { ru: 'Пройти сегодня', kk: 'Бүгін тапсыру' },
    message: {
      ru: 'Бесплатный пробный ЕНТ на сегодня снова доступен. Один тест в день — лучший способ увидеть, как растёт ваш балл.',
      kk: 'Бүгінгі тегін сынақ ҰБТ қайта қолжетімді. Күніне бір тест — балыңыздың қалай өсетінін көрудің ең жақсы жолы.',
    },
  },
  {
    key: 'channel_gate_day1',
    title: 'Не подписался на канал: день 1',
    cooldownHours: 24,
    channelButtons: true,
    channels: ['telegram'],
    path: '/dashboard',
    headline: { ru: 'Остался один шаг', kk: 'Бір ғана қадам қалды' },
    cta: { ru: 'Открыть mytest', kk: 'mytest ашу' },
    message: {
      ru: 'Остался один шаг: подпишитесь на канал, чтобы открыть доступ к пробным тестам MyTest. После подписки нажмите «Проверить подписку» в приложении.',
      kk: 'Бір ғана қадам қалды: MyTest сынақ тесттеріне кіру үшін каналға жазылыңыз. Жазылғаннан кейін қолданбада «Жазылымды тексеру» батырмасын басыңыз.',
    },
  },
  {
    key: 'channel_gate_day3',
    title: 'Не подписался на канал: день 3',
    cooldownHours: 24,
    channelButtons: true,
    channels: ['telegram'],
    path: '/dashboard',
    headline: { ru: 'Доступ к тестам ждёт вас', kk: 'Тесттерге қолжетімділік сізді күтуде' },
    cta: { ru: 'Открыть mytest', kk: 'mytest ашу' },
    message: {
      ru: 'Мы всё ещё держим для вас доступ к пробным тестам. Подпишитесь на канал, и можно сразу начинать подготовку.',
      kk: 'Сынақ тесттеріне қолжетімділікті сіз үшін сақтап тұрмыз. Каналға жазылыңыз да, дайындықты бірден бастаңыз.',
    },
  },
  {
    key: 'no_trial_day1',
    title: 'Зарегистрировался, но не прошёл ЕНТ: день 1',
    cooldownHours: 24,
    channels: ALL_CHANNELS,
    path: '/dashboard/exams',
    headline: { ru: 'Ваш первый ЕНТ ждёт', kk: 'Алғашқы ҰБТ сізді күтуде' },
    cta: { ru: 'Пройти бесплатно', kk: 'Тегін тапсыру' },
    message: {
      ru: 'Вы уже в MyTest. Пройдите первый пробный ЕНТ бесплатно в реальном формате: балл, слабые темы и разбор ошибок будут сразу после завершения.',
      kk: 'Сіз MyTest-ке кірдіңіз. Алғашқы сынақ ҰБТ-ны нақты форматта тегін тапсырыңыз: балл, әлсіз тақырыптар және қате талдауы бірден көрінеді.',
    },
  },
  {
    key: 'no_trial_day3',
    title: 'Зарегистрировался, но не прошёл ЕНТ: день 3',
    cooldownHours: 24,
    channels: ALL_CHANNELS,
    path: '/dashboard/exams',
    headline: { ru: 'Сколько баллов у вас сейчас?', kk: 'Қазір қанша балыңыз бар?' },
    cta: { ru: 'Узнать свой балл', kk: 'Балымды білу' },
    message: {
      ru: 'До ЕНТ лучше готовиться по цифрам, а не наугад. Сдайте бесплатный пробник и получите понятную картину по баллам и слабым темам.',
      kk: 'ҰБТ-ға дайындықты болжаммен емес, нақты нәтижемен бастаған дұрыс. Тегін сынақ тапсырып, балл мен әлсіз тақырыптар бойынша нақты көрініс алыңыз.',
    },
  },
  {
    key: 'post_trial_no_payment',
    title: 'Прошёл пробный, но не оплатил: 15 минут (не шлётся, пока включён «Итог ЕНТ»)',
    cooldownHours: 24,
    channels: ['telegram'],
    supersededBy: 'result_recap',
    path: '/dashboard/billing',
    headline: { ru: 'Разберите ошибки пробника', kk: 'Сынақ қателерін талдаңыз' },
    cta: { ru: 'Открыть Premium', kk: 'Premium ашу' },
    message: {
      ru: 'Вы уже прошли пробный ЕНТ — теперь важно не потерять свежие ошибки. Откройте Premium-разбор и план на следующие 7 дней, чтобы добрать баллы на следующей попытке.',
      kk: 'Сіз сынақ ҰБТ тапсырдыңыз — енді жаңа қателерді жоғалтпай талдау маңызды. Келесі сынақта балл қосу үшін Premium-талдау мен 7 күндік жоспарды ашыңыз.',
    },
  },
  {
    key: 'post_trial_day1_no_payment',
    title: 'Прошёл пробный, но не оплатил: 24 часа',
    cooldownHours: 24,
    channels: ALL_CHANNELS,
    path: '/dashboard/billing',
    headline: { ru: 'Ошибки после пробника ещё можно закрыть', kk: 'Сынақтан кейінгі қателерді әлі жабуға болады' },
    cta: { ru: 'Открыть Premium', kk: 'Premium ашу' },
    message: {
      ru: 'Ваши ошибки после пробника всё ещё можно быстро закрыть. Начните с Premium на 7 дней: разбор вопросов, работа над ошибками и следующая попытка в одном плане.',
      kk: 'Сынақтан кейінгі қателерді әлі де тез жабуға болады. 7 күндік Premium-нан бастаңыз: сұрақ талдауы, қателермен жұмыс және келесі мүмкіндік бір жоспарда.',
    },
  },
  {
    key: 'post_trial_day3_no_payment',
    title: 'Прошёл пробный, но не оплатил: 72 часа',
    cooldownHours: 24,
    channels: ALL_CHANNELS,
    path: '/dashboard/billing',
    headline: { ru: 'Не оставляйте результат просто цифрой', kk: 'Нәтижені жай сан күйінде қалдырмаңыз' },
    cta: { ru: 'Открыть Premium', kk: 'Premium ашу' },
    message: {
      ru: 'Не оставляйте результат просто цифрой. В Premium — разбор каждой ошибки, тренировка слабых тем и повтор ЕНТ, чтобы следующий пробник показал рост.',
      kk: 'Нәтижені жай сан күйінде қалдырмаңыз. Premium-да әр қатенің талдауы, әлсіз тақырыптар бойынша жаттығу және ҰБТ-ны қайта тапсыру бар — келесі сынақ өсуді көрсетеді.',
    },
  },
  {
    key: 'paid_expiring_soon',
    title: 'Paid: подписка скоро закончится',
    cooldownHours: 24,
    channels: ALL_CHANNELS,
    path: '/dashboard/billing',
    headline: { ru: 'Подписка скоро закончится', kk: 'Жазылым жақында аяқталады' },
    cta: { ru: 'Продлить доступ', kk: 'Қолжетімділікті ұзарту' },
    message: {
      ru: 'Ваша подписка скоро закончится. Успейте пройти ещё тесты и сохранить темп подготовки.',
      kk: 'Жазылымыңыз жақында аяқталады. Дайындық қарқынын сақтау үшін тағы бірнеше тест өтіп үлгеріңіз.',
    },
  },
  {
    key: 'paid_weekly_inactive',
    title: 'Paid: нет тестов 7 дней',
    cooldownHours: 168,
    channels: ALL_CHANNELS,
    path: '/dashboard/exams',
    headline: { ru: 'Подписка активна — пройдите тест', kk: 'Жазылым белсенді — тест тапсырыңыз' },
    cta: { ru: 'Пройти тест', kk: 'Тест тапсыру' },
    message: {
      ru: 'Ваша подписка активна. Загляните в MyTest и пройдите один тест: регулярная практика лучше всего показывает прогресс.',
      kk: 'Жазылымыңыз белсенді. MyTest-ке кіріп, бір тест тапсырып көріңіз: тұрақты дайындық прогресті жақсы көрсетеді.',
    },
  },
] as const;

export function getNotificationCampaignDefinition(key: string) {
  return NOTIFICATION_CAMPAIGNS.find((campaign) => campaign.key === key) ?? null;
}

export function campaignOrder(key: string) {
  const index = NOTIFICATION_CAMPAIGNS.findIndex((campaign) => campaign.key === key);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
