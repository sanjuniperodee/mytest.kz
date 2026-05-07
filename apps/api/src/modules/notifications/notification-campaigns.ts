export type NotificationCampaignKey =
  | 'abandoned_test'
  | 'channel_gate_day1'
  | 'channel_gate_day3'
  | 'no_trial_day1'
  | 'no_trial_day3'
  | 'paid_weekly_inactive'
  | 'paid_expiring_soon';

export interface NotificationMessage {
  ru: string;
  kk: string;
}

export interface NotificationCampaignDefinition {
  key: NotificationCampaignKey;
  title: string;
  cooldownHours: number;
  channelButtons?: boolean;
  message: NotificationMessage;
}

export const NOTIFICATION_CAMPAIGNS: readonly NotificationCampaignDefinition[] = [
  {
    key: 'abandoned_test',
    title: 'Начал тест, но не завершил',
    cooldownHours: 24,
    message: {
      ru: 'Вы начали пробный тест, но не завершили его. Вернитесь, чтобы увидеть результат и понять, какие темы стоит подтянуть.',
      kk: 'Сіз сынақ тестін бастап, аяқтамадыңыз. Нәтижеңізді көріп, қай тақырыптарды қайталау керек екенін білу үшін қайта кіріңіз.',
    },
  },
  {
    key: 'channel_gate_day1',
    title: 'Не подписался на канал: день 1',
    cooldownHours: 24,
    channelButtons: true,
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
    message: {
      ru: 'Мы всё ещё держим для вас доступ к пробным тестам. Подпишитесь на канал, и можно сразу начинать подготовку.',
      kk: 'Сынақ тесттеріне қолжетімділікті сіз үшін сақтап тұрмыз. Каналға жазылыңыз да, дайындықты бірден бастаңыз.',
    },
  },
  {
    key: 'no_trial_day1',
    title: 'Подписался, но не прошёл пробный: день 1',
    cooldownHours: 24,
    message: {
      ru: 'Вы уже в MyTest. Пройдите первый пробный тест сегодня: результат покажет ваш текущий уровень и слабые темы.',
      kk: 'Сіз MyTest-ке кірдіңіз. Бүгін алғашқы сынақ тестін тапсырып көріңіз: нәтиже қазіргі деңгейіңізді және әлсіз тақырыптарды көрсетеді.',
    },
  },
  {
    key: 'no_trial_day3',
    title: 'Подписался, но не прошёл пробный: день 3',
    cooldownHours: 24,
    message: {
      ru: 'До ЕНТ лучше готовиться по цифрам, а не наугад. Пройдите пробный тест и получите понятную картину по баллам.',
      kk: 'ҰБТ-ға дайындықты болжаммен емес, нақты нәтижемен бастаған дұрыс. Сынақ тестін өтіп, баллыңыз бойынша түсінікті көрініс алыңыз.',
    },
  },
  {
    key: 'paid_weekly_inactive',
    title: 'Paid: нет тестов 7 дней',
    cooldownHours: 168,
    message: {
      ru: 'Ваша подписка активна. Загляните в MyTest и пройдите один тест: регулярная практика лучше всего показывает прогресс.',
      kk: 'Жазылымыңыз белсенді. MyTest-ке кіріп, бір тест тапсырып көріңіз: тұрақты дайындық прогресті жақсы көрсетеді.',
    },
  },
  {
    key: 'paid_expiring_soon',
    title: 'Paid: подписка скоро закончится',
    cooldownHours: 24,
    message: {
      ru: 'Ваша подписка скоро закончится. Успейте пройти ещё тесты и сохранить темп подготовки.',
      kk: 'Жазылымыңыз жақында аяқталады. Дайындық қарқынын сақтау үшін тағы бірнеше тест өтіп үлгеріңіз.',
    },
  },
] as const;

export function getNotificationCampaignDefinition(key: string) {
  return NOTIFICATION_CAMPAIGNS.find((campaign) => campaign.key === key) ?? null;
}
