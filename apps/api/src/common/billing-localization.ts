// Translate presentation fields only. Codes, customer data and payment metadata
// must never be rewritten by a display-language conversion.
const kk: Record<string, string> = {
  'Разовый': 'Бір реттік', 'Пробный': 'Сынақ', '3 пробных': '3 сынақ', '5 пробных': '5 сынақ',
  'Месяц без лимита': 'Ай шектеусіз', 'популярно': 'танымал',
  'Одна полная попытка ЕНТ с Premium-разбором. Доступ действует 7 дней.': 'Premium талдауы бар бір толық ҰБТ сынағы. Қолжетімділік 7 күнге беріледі.',
  'Три полные попытки ЕНТ с Premium-разбором. Доступ действует 30 дней.': 'Premium талдауы бар үш толық ҰБТ сынағы. Қолжетімділік 30 күнге беріледі.',
  'Пять полных попыток ЕНТ с Premium-разбором. Доступ действует 30 дней.': 'Premium талдауы бар бес толық ҰБТ сынағы. Қолжетімділік 30 күнге беріледі.',
  'Безлимитные попытки ЕНТ в течение 30 дней.': '30 күн бойы шексіз ҰБТ сынақтары.',
  '1 полный пробный ЕНТ': '1 толық ҰБТ сынағы', '3 полных пробных ЕНТ': '3 толық ҰБТ сынағы',
  '5 полных пробных ЕНТ': '5 толық ҰБТ сынағы', 'Premium-разбор вопросов': 'Сұрақтарды Premium талдау',
  'Доступ 7 дней': '7 күн қолжетімділік', 'Статистика по попыткам': 'Сынақтар статистикасы',
  'Безлимитные попытки ЕНТ': 'Шексіз ҰБТ сынақтары', 'Доступ на 30 дней': '30 күн қолжетімділік',
  'Аналитика': 'Талдау', 'Premium не подключён': 'Premium қосылмаған',
  'Пробники, пересдача и работа над ошибками открываются в Premium': 'Сынақтар, қайта тапсыру және қателермен жұмыс Premium арқылы ашылады',
  'Стартовый доступ': 'Бастапқы қолжетімділік', 'Пробные попытки для ЕНТ': 'ҰБТ сынақтары',
  'Админ-доступ': 'Әкімші берген қолжетімділік', 'Подписка на год': 'Бір жылға жазылым',
  'Подписка на месяц': 'Бір айға жазылым', 'Подписка на месяц без лимита': 'Бір айға шексіз жазылым',
  'Free ENT trial': 'Тегін ҰБТ сынағы',
  'Automatically grants 2 ENT attempts to registered users.': 'Тіркелген пайдаланушыларға автоматты түрде 2 ҰБТ сынағы беріледі.',
};

export function localizeBillingText(value: unknown, lang: string): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (lang === 'ru') {
    if (text === 'Free ENT trial') return 'Бесплатный пробный ЕНТ';
    if (text === 'Automatically grants 2 ENT attempts to registered users.') return 'Зарегистрированным пользователям автоматически предоставляются 2 попытки ЕНТ.';
    return value;
  }
  if (lang !== 'kk') return value;
  if (kk[text]) return kk[text];
  const subscription = text.match(/^Подписка на (\d+) пробны(?:й|х) на (\d+) (?:день|дня|дней)$/);
  if (subscription) return `${subscription[2]} күнге ${subscription[1]} сынаққа жазылым`;
  return value;
}

export function localizeBillingFields(data: any, lang: string): any {
  if (Array.isArray(data)) return data.map(item => localizeBillingFields(item, lang));
  if (!data || typeof data !== 'object') return data;
  const result = { ...data };
  for (const key of ['name', 'description', 'highlight']) {
    if (key in result) result[key] = localizeBillingText(result[key], lang);
  }
  if (Array.isArray(result.features)) result.features = result.features.map((value: unknown) => localizeBillingText(value, lang));
  return result;
}
