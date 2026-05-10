import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

/** Язык интерфейса приложения: только русский и қазақша (английский не предлагаем). */
export type UiLocale = "ru" | "kk"

const STORAGE_KEY = "mytest-locale"

/** Приводит сохранённое/профильное значение к UI-локали (en и прочее → ru). */
export function normalizeUiLocale(raw: string | null | undefined): UiLocale {
  if (raw === "kk") return "kk"
  return "ru"
}

type UiLocaleContextValue = {
  locale: UiLocale
  setLocale: (l: UiLocale) => void
}

const UiLocaleContext = createContext<UiLocaleContextValue | null>(null)

const STRINGS: Record<string, { ru: string; kk: string }> = {
  overview: { ru: "Обзор", kk: "Шолу" },
  exams: { ru: "Экзамены", kk: "Емтихандар" },
  mistakes: { ru: "Мои ошибки", kk: "Менің қателерім" },
  admission: { ru: "Шанс поступления", kk: "Түсу мүмкіндігі" },
  leaderboard: { ru: "Лидерборд ЕНТ", kk: "ЕНТ көшбасшылары" },
  billing: { ru: "Тарифы", kk: "Тарифтер" },
  profile: { ru: "Профиль", kk: "Профиль" },
  drawerCurrentExam: { ru: "Текущий пробник", kk: "Ағымдағы сынақ" },
  stats: { ru: "Динамика ЕНТ", kk: "ЕНТ динамикасы" },
  channelGate: { ru: "Подписка", kk: "Жазылу" },
  login: { ru: "Вход", kk: "Кіру" },
  logout: { ru: "Выйти", kk: "Шығу" },
  menu: { ru: "Меню", kk: "Мәзір" },
  closeMenu: { ru: "Закрыть меню", kk: "Мәзірді жабу" },
  openMenu: { ru: "Открыть меню", kk: "Мәзірді ашу" },
  language: { ru: "Язык", kk: "Тіл" },

  loginSubtitle: {
    ru: "Тот же аккаунт, что на сайте my-test.kz",
    kk: "Сайттағы my-test.kz сияқты аккаунт",
  },
  loginPhone: { ru: "Телефон", kk: "Телефон" },
  loginGoogle: { ru: "Google", kk: "Google" },
  loginBack: { ru: "Назад", kk: "Артқа" },
  loginGoogleFail: { ru: "Не удалось войти", kk: "Кіру мүмкін болмады" },

  cgTitle: { ru: "Подпишитесь на канал", kk: "Арнаға жазылыңыз" },
  cgDesc: {
    ru: "Чтобы открыть пробные тесты MyTest, подпишитесь на наш Telegram-канал.",
    kk: "MyTest сынақ тесттерін ашу үшін Telegram-арнамызға жазылыңыз.",
  },
  cgHintAfterSub: {
    ru: "После подписки вернитесь сюда и нажмите проверку.",
    kk: "Жазылғаннан кейін осында оралып, тексеруді басыңыз.",
  },
  cgOpenChannel: { ru: "Открыть канал", kk: "Арнаны ашу" },
  cgVerifySub: { ru: "Проверить подписку", kk: "Жазылуды тексеру" },
  cgChecking: { ru: "Проверяем...", kk: "Тексерілуде..." },
  cgNoteTelegramOnly: {
    ru: "Подписка нужна только для пользователей, которые вошли через Telegram.",
    kk: "Жазылу тек Telegram арқылы кірген пайдаланушыларға қажет.",
  },
  cgAlertOkTitle: { ru: "Готово", kk: "Дайын" },
  cgAlertOkBody: { ru: "Подписка подтверждена", kk: "Жазылу расталды" },
  cgAlertPendingTitle: { ru: "Подписка пока не найдена", kk: "Жазылу әлі табылмады" },
  cgAlertPendingBody: {
    ru: "Подпишитесь на канал и попробуйте снова.",
    kk: "Арнаға жазылып, қайта көріңіз.",
  },

  profileSubtitle: {
    ru: "Личные данные и настройки аккаунта",
    kk: "Жеке мәліметтер және аккаунт баптаулары",
  },
  profileAccount: { ru: "Аккаунт", kk: "Аккаунт" },
  profileUploadPhoto: { ru: "Загрузить фото", kk: "Фото жүктеу" },
  profileDeletePhoto: { ru: "Удалить", kk: "Жою" },
  profileAvatarHint: {
    ru: "JPG, PNG или WebP до 3 МБ.",
    kk: "JPG, PNG немесе WebP, 3 МБ-қа дейін.",
  },
  profileInterfaceLang: { ru: "Язык интерфейса", kk: "Интерфейс тілі" },
  profileTimezone: { ru: "Часовой пояс", kk: "Уақыт белдеуі" },
  profileSave: { ru: "Сохранить", kk: "Сақтау" },
  profileSaving: { ru: "Сохранение...", kk: "Сақталуда..." },
  profileUserPlaceholder: { ru: "Пользователь", kk: "Пайдаланушы" },
  langRussian: { ru: "Русский", kk: "Орысша" },
  langKazakh: { ru: "Қазақша", kk: "Қазақша" },
  alertDone: { ru: "Готово", kk: "Дайын" },
  alertError: { ru: "Ошибка", kk: "Қате" },
  alertSettingsSaved: { ru: "Настройки сохранены", kk: "Баптаулар сақталды" },
  alertSaveFailed: { ru: "Не удалось сохранить", kk: "Сақталмады" },
  alertAvatarUpdated: { ru: "Аватарка обновлена", kk: "Аватар жаңартылды" },
  alertAvatarDeleted: { ru: "Аватарка удалена", kk: "Аватар жойылды" },
  alertAvatarUploadFail: {
    ru: "Не удалось загрузить аватарку",
    kk: "Аватарды жүктеу сәтсіз аяқталды",
  },
  alertAvatarDeleteFail: {
    ru: "Не удалось удалить аватарку",
    kk: "Аватарды жою сәтсіз аяқталды",
  },
  alertFormatTitle: { ru: "Формат", kk: "Формат" },
  alertFormatBody: {
    ru: "Загрузите изображение JPG, PNG или WebP",
    kk: "JPG, PNG немесе WebP суретін жүктеңіз",
  },
  alertSizeTitle: { ru: "Размер", kk: "Өлшем" },
  alertSizeBody: {
    ru: "Аватарка должна быть меньше 3 МБ",
    kk: "Аватар 3 МБ-тан кіші болуы керек",
  },
  profilePhotoTitle: { ru: "Фото", kk: "Фото" },
  profilePhotoWebUnavailable: {
    ru: "Загрузка аватарки в веб-версии недоступна",
    kk: "Веб-нұсқада аватар жүктелмейді",
  },
  profileGalleryUnavailable: {
    ru: "Галерея недоступна",
    kk: "Галерея қолжетімсіз",
  },
  profileGalleryPermission: {
    ru: "Разрешите доступ к галерее в настройках",
    kk: "Баптауларда галереяға рұқсат беріңіз",
  },
  profileGalleryModuleHint: {
    ru: "Модуль выбора фото не подключён. Добавьте плагин expo-image-picker в app.json и выполните expo prebuild / expo run:ios или expo run:android.",
    kk: "Фото таңдау модулі қосылмаған. app.json-ға expo-image-picker қосып, expo prebuild және expo run:ios/android орындаңыз.",
  },
  profileGalleryNativeHint: {
    ru: "Нативный модуль не найден. Пересоберите приложение после добавления expo-image-picker: expo prebuild и expo run:ios / run:android.",
    kk: "Нативті модуль табылмады. expo-image-picker қосқаннан кейін қолданбаны қайта жинаңыз: expo prebuild, содан кейін expo run.",
  },
  profileGalleryError: {
    ru: "Не удалось открыть галерею",
    kk: "Галереяны ашу мүмкін болмады",
  },

  mistakesTitle: { ru: "Работа над ошибками", kk: "Қателермен жұмыс" },
  mistakesLead: {
    ru: "Прорабатывайте вопросы, в которых ранее ошиблись, чтобы закрыть пробелы быстрее",
    kk: "Бұрын қателескен сұрақтарды қайталап, бос орындарды тез жабыңыз",
  },
  mistakesTotalErrors: { ru: "Всего ошибок", kk: "Қателер саны" },
  mistakesTotalHint: {
    ru: "Каждая отработанная ошибка приближает к высокому баллу",
    kk: "Әр қатені қалпына келтіру жоғары баллға жақындатады",
  },
  mistakesByExam: { ru: "По экзаменам", kk: "Емтихандар бойынша" },
  mistakesNoErrors: { ru: "Пока нет ошибок — отлично!", kk: "Қате жоқ — керемет!" },
  mistakesStartTraining: { ru: "Запустить тренировку", kk: "Жаттығуды бастау" },
  mistakesExam: { ru: "Экзамен", kk: "Емтихан" },
  mistakesSubject: { ru: "Предмет", kk: "Пән" },
  mistakesQuestions: { ru: "Количество вопросов", kk: "Сұрақтар саны" },
  mistakesDurationMin: { ru: "Длительность, мин", kk: "Ұзақтығы, мин" },
  mistakesCtaTitle: {
    ru: "Подберём вопросы автоматически",
    kk: "Сұрақтарды автоматты таңдаймыз",
  },
  mistakesCtaBodyPrefix: {
    ru: "Берём ваши прошлые ошибки и формируем мини-тест на ",
    kk: "Өткен қателеріңізден мини-тест жасаймыз, ",
  },
  mistakesCtaBodySuffix: {
    ru: " вопросов",
    kk: " сұрақ",
  },
  mistakesStartBtn: { ru: "Начать тренировку", kk: "Жаттығуды бастау" },
  mistakesHelperAllExams: {
    ru: "Будут включены ошибки из всех экзаменов",
    kk: "Барлық емтихан қателері қосылады",
  },
  mistakesHelperAllSubjects: {
    ru: "Будут включены ошибки из всех предметов",
    kk: "Барлық пән қателері қосылады",
  },
  mistakesAllExams: { ru: "Все экзамены", kk: "Барлық емтихандар" },
  mistakesAllSubjects: { ru: "Все предметы", kk: "Барлық пәндер" },
  mistakesEmptyHint: {
    ru: "Сначала пройдите хотя бы один пробник — после него ваши ошибки появятся тут.",
    kk: "Алдымен кем дегенде бір сынақ тесттен өтіңіз — содан кейін қателер осы жерде пайда болады.",
  },
  mistakesErrStart: {
    ru: "Не удалось запустить практику",
    kk: "Жаттығуды бастау мүмкін болмады",
  },
  mistakesErrPickExam: {
    ru: "Выберите конкретный экзамен",
    kk: "Нақты емтиханды таңдаңыз",
  },
  mistakesErrNoSubjectMistakes: {
    ru: "По этому предмету нет открытых ошибок",
    kk: "Бұл пән бойынша ашық қателер жоқ",
  },
  mistakesErrNoMistakes: {
    ru: "Открытых ошибок пока нет",
    kk: "Ашық қателер әлі жоқ",
  },

  billPill: { ru: "Подписка", kk: "Жазылым" },
  billTitle: { ru: "Тарифы", kk: "Тарифтер" },
  billLead: {
    ru: "Откройте полный доступ к пробникам, разборам и аналитике",
    kk: "Сынақ тесттерге, талдауға және аналитикаға толық қол жеткізіңіз",
  },
  billEmpty: { ru: "Тарифы временно недоступны", kk: "Тарифтер уақытша қолжетімсіз" },
  billFooter: {
    ru: "Для оплаты откройте WhatsApp: мы выставим счёт и подключим Premium после подтверждения платежа.",
    kk: "Төлем үшін WhatsApp ашыңыз: шот ұсынамыз және төлем расталғаннан кейін Premium қосамыз.",
  },
  billRecommended: { ru: "Рекомендуем", kk: "Ұсынамыз" },
  billCurrentBadge: { ru: "Текущий", kk: "Ағымдағы" },
  billCheckout: { ru: "Оформить", kk: "Рәсімдеу" },
  billCurrentTariff: { ru: "Текущий тариф", kk: "Ағымдағы тариф" },
  billDurationPrefix: { ru: "Срок действия:", kk: "Мерзімі:" },
  billDay: { ru: "день", kk: "күн" },
  billDays2to4: { ru: "дня", kk: "күн" },
  billDays5plus: { ru: "дней", kk: "күн" },
  billFeat1: { ru: "Безлимитные пробники", kk: "Шексіз сынақ тесттер" },
  billFeat2: { ru: "Разбор каждого вопроса", kk: "Әр сұрақты талдау" },
  billFeat3: { ru: "Аналитика по предметам", kk: "Пәндер бойынша аналитика" },
  billFeat4: { ru: "Лидерборд ЕНТ", kk: "ЕНТ көшбасшылары" },
  billTariffCurrentPrefix: { ru: "Текущий тариф:", kk: "Ағымдағы тариф:" },
  billInactive: { ru: "Неактивен", kk: "Белсенді емес" },
  billExpires: { ru: "Действует до", kk: "Әрекет ету мерзімі" },
  billMetricDailyLeft: { ru: "Сегодня осталось", kk: "Бүгін қалды" },
  billMetricTrial: { ru: "Пробные попытки", kk: "Сынақ әрекеттері" },
  billTariffDefaultPaid: { ru: "Premium", kk: "Premium" },
  billTariffDefaultFree: { ru: "Стартовый доступ", kk: "Бастапқы қолжетімділік" },
  billUnlimitedDaily: { ru: "Без дневного лимита", kk: "Күнделікті шектеусіз" },
  billDailyUnknown: { ru: "Дневной лимит не задан", kk: "Күнделікті лимит көрсетілмеген" },
  billUnlimited: { ru: "Без лимита", kk: "Шектеусіз" },

  lbPill: { ru: "Соревнование", kk: "Жарыс" },
  lbTitle: { ru: "Лидерборд ЕНТ", kk: "ЕНТ көшбасшылары" },
  lbSub: {
    ru: "Топ участников по набранным баллам пробного ЕНТ",
    kk: "Сынақ ЕНТ баллары бойынша үздік қатысушылар",
  },
  lbTopPrefix: { ru: "Топ ", kk: "Топ " },
  lbRankPrefix: { ru: "Ваш ранг: ", kk: "Сіздің орныңыз: " },
  lbPointsSuffix: { ru: " баллов", kk: " балл" },
  lbAllParticipants: { ru: "Все участники", kk: "Барлық қатысушылар" },
  lbNoResults: { ru: "Пока нет результатов", kk: "Әлі нәтиже жоқ" },
  lbNoResultsHint: {
    ru: "Пройдите пробный ЕНТ, чтобы попасть в топ",
    kk: "Топқа ену үшін сынақ ЕНТ-тен өтіңіз",
  },
  lbOnlyTop3: {
    ru: "Пока только участники топ-3",
    kk: "Әзірге тек топ-3 қатысушылары",
  },
  lbAnonymous: { ru: "Аноним", kk: "Аноним" },
  lbYou: { ru: "(вы)", kk: "(сіз)" },
  lbPlace1: { ru: "1 место", kk: "1-орын" },
  lbPlace2: { ru: "2 место", kk: "2-орын" },
  lbPlace3: { ru: "3 место", kk: "3-орын" },
  lbPointsShort: { ru: "баллов", kk: "балл" },
  lbTests: { ru: "тестов", kk: "тест" },

  statsEmpty: {
    ru: "Пока нет данных. Сдайте первый пробный ЕНТ, чтобы увидеть график.",
    kk: "Әлі дерек жоқ. Графикті көру үшін алғашқы сынақ ЕНТ-тен өтіңіз.",
  },
  statsProgressByAttempts: { ru: "Прогресс по попыткам", kk: "Әрекеттер бойынша прогресс" },
  statsHistory: { ru: "История попыток", kk: "Әрекеттер тарихы" },
  statsColDate: { ru: "Дата", kk: "Күні" },
  statsColScore: { ru: "Балл", kk: "Балл" },
  statsColMax: { ru: "Макс", kk: "Макс" },
  statsColPct: { ru: "%", kk: "%" },
  statsColLang: { ru: "Язык", kk: "Тіл" },

  examsPill: { ru: "Каталог пробников", kk: "Сынақ каталогы" },
  examsTitle: { ru: "Экзамены", kk: "Емтихандар" },
  examsLead: {
    ru: "Выберите тип экзамена, чтобы начать пробное тестирование",
    kk: "Сынақ тестілеуді бастау үшін емтихан түрін таңдаңыз",
  },
  examsEmpty: { ru: "Каталог экзаменов пока пуст", kk: "Емтихан каталогы бос" },
  examsOpen: { ru: "Открыть", kk: "Ашу" },
  examFallbackName: { ru: "Экзамен", kk: "Емтихан" },
  examSubjectFallback: { ru: "Предмет", kk: "Пән" },
  examTemplateFallback: { ru: "Пробник", kk: "Сынақ" },

  admBadge2026: { ru: "Калькулятор поступления 2026", kk: "Түсу калькуляторы 2026" },
  admHeroTitle: {
    ru: "Куда пройдёшь с твоими баллами ЕНТ?",
    kk: "ЕНТ балларыңмен қайда түсесің?",
  },
  admHeroLead: {
    ru: "Введи баллы — посмотри, в какие вузы и на какие специальности ты проходишь по грантовым и сельским квотам прошлых лет.",
    kk: "Балл енгіз — өткен жылдардағы грант және ауыл квоталары бойынша қай ЖОО мен мамандыққа түсетініңді көр.",
  },
  admParams: { ru: "Параметры", kk: "Параметрлер" },
  admCycle: { ru: "Цикл поступления", kk: "Түсу циклі" },
  admQuotaType: { ru: "Тип квоты", kk: "Квота түрі" },
  admQuotaGrant: { ru: "Грант", kk: "Грант" },
  admQuotaRural: { ru: "Сельская", kk: "Ауылдық" },
  admProfileSubjects: { ru: "Профильные предметы", kk: "Профильді пәндер" },
  admProfileHint: {
    ru: "Сначала выберите пару профильных предметов",
    kk: "Алдымен профильді пән жұбын таңдаңыз",
  },
  admEntScores: { ru: "Баллы ЕНТ", kk: "ЕНТ баллы" },
  admEdit: { ru: "Изменить", kk: "Өзгерту" },
  admSelectedPrefix: { ru: "Выбрано: ", kk: "Таңдалған: " },
  admStep1Box: {
    ru: "Шаг 1 из 2: выберите пару профильных предметов",
    kk: "1-қадам (2-ден): профильді пән жұбын таңдаңыз",
  },
  admProgramsTab: { ru: "Специальности", kk: "Мамандықтар" },
  admUnisTab: { ru: "Вузы", kk: "ЖОО" },
  admSearchPh: { ru: "Поиск...", kk: "Іздеу..." },
  admEmptyStep1: {
    ru: "Сначала выберите пару профильных предметов слева, чтобы увидеть результаты",
    kk: "Нәтижені көру үшін алдымен сол жақтан профильді пән жұбын таңдаңыз",
  },
  admEmptyParams: {
    ru: "Выберите параметры слева, чтобы увидеть подходящие специальности",
    kk: "Сәйкес мамандықтарды көру үшін сол жақтан параметрлерді таңдаңыз",
  },
  admEmptyNoPrograms: {
    ru: "Под ваши параметры пока нет результатов",
    kk: "Параметрлеріңіз бойынша әлі нәтиже жоқ",
  },
  admPassingSummary: { ru: " специальностей подходят", kk: " мамандық сәйкес келеді" },
  admPassingOf: { ru: " из ", kk: " ішінен " },
  admYourScore: { ru: "Ваш балл:", kk: "Сіздің баллыңыз:" },
  admCompareCutoffs: {
    ru: "Сравниваем с пороговыми баллами прошлых лет",
    kk: "Өткен жылдардағы шекті баллдармен салыстырамыз",
  },
  admThreshold: { ru: "Порог", kk: "Шек" },
  admSurplus: { ru: "Запас", kk: "Қор" },
  admShortage: { ru: "Не хватает", kk: "Жетіспейді" },
  admProfileLabel: { ru: "Профиль:", kk: "Профиль:" },
  admUniCount: { ru: " вузов", kk: " ЖОО" },
  admSpecialty: { ru: "Специальность", kk: "Мамандық" },
  admPickSpecialty: {
    ru: "Выберите специальность",
    kk: "Мамандықты таңдаңыз",
  },
  admEmptyPickProgram: {
    ru: "Выберите специальность, чтобы увидеть список вузов",
    kk: "ЖОО тізімін көру үшін мамандықты таңдаңыз",
  },
  admEmptyUniData: {
    ru: "Нет данных по этой специальности",
    kk: "Бұл мамандық бойынша дерек жоқ",
  },
  admCodePrefix: { ru: "Код ", kk: "Код " },
  admThresholdLabel: { ru: "Порог ", kk: "Шек " },

  admScoreMathLit: { ru: "Мат. грамотность", kk: "Мат. сауаттылық" },
  admScoreReadingLit: { ru: "Чит. грамотность", kk: "Оқу сауаттылығы" },
  admScoreHistory: { ru: "История Казахстана", kk: "Қазақстан тарихы" },
  admScoreProf1: { ru: "Профильный 1", kk: "Профильді 1" },
  admScoreProf2: { ru: "Профильный 2", kk: "Профильді 2" },

  examAlertUnavailableTitle: { ru: "Недоступно", kk: "Қолжетімсіз" },
  examAlertUnavailableBody: {
    ru: "Пробник пока недоступен",
    kk: "Сынақ әлі қолжетімсіз",
  },
  examAlertProfileTitle: { ru: "Профиль", kk: "Профиль" },
  examAlertProfileBody: {
    ru: "Выберите одну из доступных пар профильных предметов",
    kk: "Қолжетімді профильді пән жұптарының бірін таңдаңыз",
  },
  examAlertErrorTitle: { ru: "Ошибка", kk: "Қате" },
  examAlertStartFail: {
    ru: "Не удалось запустить тест",
    kk: "Тестті іске қосу мүмкін болмады",
  },
  examScopeMandatory: { ru: "Только обязательные", kk: "Тек міндетті пәндер" },
  examScopeMandatorySub: {
    ru: "Математическая грамотность, грамотность чтения, история",
    kk: "Математикалық сауаттылық, оқу сауаттылығы, тарих",
  },
  examScopeProfile: { ru: "Только профильные", kk: "Тек профильді пәндер" },
  examScopeProfileSub: {
    ru: "Два профильных предмета",
    kk: "Екі профильді пән",
  },
  examScopeFull: { ru: "Полный ЕНТ", kk: "Толық ЕНТ" },
  examScopeFullSub: {
    ru: "Все обязательные и профильные предметы",
    kk: "Барлық міндетті және профильді пәндер",
  },
  examQAbbr: { ru: "вопр.", kk: "сұрақ" },
  examQuickStartEnt: { ru: "Быстрый старт ЕНТ", kk: "ЕНТ жылдам бастау" },
  examTaskLanguage: { ru: "Язык заданий", kk: "Тапсырма тілі" },
  examEntVolume: { ru: "Объём ЕНТ", kk: "ЕНТ көлемі" },
  examProfilePairTitle: {
    ru: "Пара профильных предметов",
    kk: "Профильді пән жұбы",
  },
  examPairSelected: { ru: "Выбрана", kk: "Таңдалды" },
  examPairNotSelected: { ru: "Не выбрана", kk: "Таңдалмаған" },
  examProfileSubjectsHint: {
    ru: "Сейчас открыты Математика, Физика, Информатика и География. Остальные профильные предметы появятся после наполнения базы.",
    kk: "Қазір Математика, Физика, Информатика және География ашық. Басқа профильді пәндер база толық болғаннан кейін пайда болады.",
  },
  examProfilePairsEmpty: {
    ru: "Доступные пары профильных предметов пока не настроены",
    kk: "Қолжетімді профильді пән жұптары әлі бапталмаған",
  },
  examStartEnt: { ru: "Начать пробный ЕНТ", kk: "Сынақ ЕНТ бастау" },
  examWhatsInTest: { ru: "Что войдёт в тест", kk: "Тестке не кіреді" },
  examMandatoryBlock: { ru: "Обязательные", kk: "Міндетті пәндер" },
  examProfileBlock: { ru: "Профильные", kk: "Профильді пәндер" },
  examPickPairBeforeStart: {
    ru: "Выберите пару перед стартом",
    kk: "Бастамас бұрын жұпты таңдаңыз",
  },
  examTplUnavailableShort: {
    ru: "Пробник пока недоступен",
    kk: "Сынақ әлі қолжетімсіз",
  },
  examTemplatesSection: { ru: "Доступные пробники", kk: "Қолжетімді сынақтар" },
  examNoTemplates: {
    ru: "Пока нет доступных пробников",
    kk: "Әлі қолжетімді сынақтар жоқ",
  },
  examQuestionsWord: { ru: "вопросов", kk: "сұрақ" },
  examStart: { ru: "Начать", kk: "Бастау" },
  examModalLead: {
    ru: "Настройте параметры пробника перед запуском",
    kk: "Бастамас бұрын сынақ параметрлерін баптаңыз",
  },
  examCancel: { ru: "Отмена", kk: "Бас тарту" },
  examStartTemplate: { ru: "Начать пробник", kk: "Сынақты бастау" },
  examSubjUnavailable: {
    ru: "Список предметов недоступен",
    kk: "Пәндер тізімі қолжетімсіз",
  },
  examSubjectSoon: { ru: "скоро", kk: "жақында" },

  homeHeroBadge: { ru: "Готов к ЕНТ", kk: "ЕНТ-ге дайынсың" },
  homeGreetingHi: { ru: "Привет", kk: "Сәлем" },
  homeSub: {
    ru: "Готов к новому пробному ЕНТ? Продолжим там, где остановились — каждая отработанная ошибка приближает к высокому баллу.",
    kk: "Жаңа сынақ ЕНТ-ге дайынсын ба? Тоқтаған жерден жалғастырамыз — әр қатені қалпына келтіру жоғары баллға жақындатады.",
  },
  homeTariff: { ru: "Текущий тариф", kk: "Ағымдағы тариф" },
  homeDailyLeft: { ru: "Сегодня осталось", kk: "Бүгін қалды" },
  homeTrialAttempts: { ru: "Пробные попытки", kk: "Сынақ әрекеттері" },
  homeContinue: { ru: "Продолжить", kk: "Жалғастыру" },
  homeTakeTrial: { ru: "Сдать пробный", kk: "Сынақ тапсыру" },
  homeStatCompleted: { ru: "Пройдено пробников", kk: "Өткен сынақтар" },
  homeStatAvg: { ru: "Средний результат", kk: "Орташа нәтиже" },
  homeStatBest: { ru: "Лучший результат", kk: "Ең жақсы нәтиже" },
  homeStatInProgress: { ru: "В процессе", kk: "Орындалуда" },
  homeSessionsTitle: { ru: "Последние пробники", kk: "Соңғы сынақтар" },
  homeSessionsTakeTrial: { ru: "Сдать пробный", kk: "Сынақ тапсыру" },
  homeQuickStartTitle: { ru: "Старт за минуту", kk: "Бір минутта бастау" },
  homeQuickMistakes: { ru: "Работа над ошибками", kk: "Қателермен жұмыс" },
  homeQuickLb: { ru: "Лидерборд ЕНТ", kk: "ЕНТ көшбасшылары" },
  homeQuickProgress: { ru: "Мой прогресс", kk: "Менің прогрессім" },
  homeTrialSessionName: { ru: "Пробный тест", kk: "Сынақ тест" },
  homeEntProgressTitle: { ru: "Прогресс ЕНТ", kk: "ЕНТ прогресі" },
  homeLastNPrefix: { ru: "последние ", kk: "соңғы " },
  homeChartEmptyTitle: {
    ru: "График появится после ЕНТ",
    kk: "ЕНТ-тен кейін график пайда болады",
  },
  homeChartEmptyText: {
    ru: "Завершите хотя бы один полный пробный ЕНТ, чтобы увидеть динамику баллов.",
    kk: "Балл динамикасын көру үшін кем дегенде бір толық сынақ ЕНТ аяқтаңыз.",
  },
  homeMiniLast: { ru: "Последний", kk: "Соңғысы" },
  homeMiniBestScore: { ru: "Лучший балл", kk: "Ең жоғары балл" },
  homeMiniTrend: { ru: "Динамика", kk: "Динамика" },
  homeExamStatsTitle: { ru: "Статистика по экзаменам", kk: "Емтихандар бойынша статистика" },
  homeCatalogLink: { ru: "Каталог", kk: "Каталог" },
  homeExamStatsEmptyTitle: { ru: "Данных пока нет", kk: "Әлі дерек жоқ" },
  homeExamStatsEmptyText: {
    ru: "После первого завершённого пробника здесь появится разбивка по экзаменам.",
    kk: "Алғашқы аяқталған сынақтан кейін осында емтихан бойынша бөлініс пайда болады.",
  },
  homeAttempts: { ru: "Попыток", kk: "Әрекет" },
  homeFinished: { ru: "Завершено", kk: "Аяқталған" },
  homeBestScores: { ru: "Лучшие баллы", kk: "Ең жақсы баллдар" },
  homeAvgTime: { ru: "Среднее время", kk: "Орташа уақыт" },
  homeAvgResult: { ru: "Средний результат", kk: "Орташа нәтиже" },
  homeAccuracy: { ru: "Точность", kk: "Дәлдік" },
  homeActivityTitle: { ru: "Активность", kk: "Белсенділік" },
  homeCompletionRate: { ru: "Завершение пробников", kk: "Сынақтарды аяқтау" },
  homeStarted: { ru: "Начато", kk: "Басталған" },
  homeCompleted: { ru: "Закончено", kk: "Аяқталған" },
  homeInProgress: { ru: "В процессе", kk: "Орындалуда" },
  homeTrendResultsTitle: { ru: "Динамика результатов", kk: "Нәтиже динамикасы" },
  homeTrendEmptyTitle: {
    ru: "Динамика появится позже",
    kk: "Динамика кейінірек пайда болады",
  },
  homeTrendEmptyText: {
    ru: "Нужно хотя бы несколько завершённых тестов с оценкой.",
    kk: "Бағалауы бар бірнеше аяқталған тест қажет.",
  },
  homeAccessTitle: { ru: "Доступ", kk: "Қолжетімділік" },
  homeAccessEmptyTitle: {
    ru: "Лимиты не загружены",
    kk: "Лимиттер жүктелмеді",
  },
  homeAccessEmptyText: {
    ru: "Доступ подтянется после обновления профиля.",
    kk: "Профиль жаңартылғаннан кейін қолжетімділік жүктеледі.",
  },
  homeAccessYes: { ru: "Доступ есть", kk: "Қолжетімділік бар" },
  accessLimitDay: { ru: "Лимит дня", kk: "Күндік лимит" },
  accessLimitTotal: { ru: "Лимит исчерпан", kk: "Лимит таусылды" },
  accessNoAccess: { ru: "Нет доступа", kk: "Қолжетімдік жоқ" },
  accessUnlimitedDaily: { ru: "Без дневного лимита", kk: "Күнделікті шектеусіз" },
  accessDailyUnset: { ru: "Дневной лимит не задан", kk: "Күнделікті лимит көрсетілмеген" },
  accessTodayPrefix: { ru: "Сегодня: ", kk: "Бүгін: " },
  accessUnlimitedShort: { ru: "Без лимита", kk: "Шектеусіз" },
  dashEmptySessionsTitle: { ru: "Пока нет пробников", kk: "Әлі сынақ жоқ" },
  dashEmptySessionsText: {
    ru: "Запустите первый бесплатно — займёт 5 секунд",
    kk: "Алғашқысын тегін бастаңыз — 5 секунд алады",
  },
  sessionInProgress: { ru: "В процессе", kk: "Орындалуда" },
  sessionCompleted: { ru: "Завершён", kk: "Аяқталды" },
  sessionTimedOut: { ru: "Время вышло", kk: "Уақыт аяқталды" },
  sessionAbandoned: { ru: "Отменён", kk: "Бас тартылды" },
  minutesShort: { ru: " мин", kk: " мин" },
  examBackToCatalog: { ru: "К каталогу", kk: "Каталогқа" },
  examSubjects: { ru: "Предметы", kk: "Пәндер" },
}

export function t(key: string, locale: UiLocale): string {
  const row = STRINGS[key]
  if (!row) return key
  return locale === "kk" ? row.kk : row.ru
}

export function UiLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLoc] = useState<UiLocale>("ru")

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      setLoc(normalizeUiLocale(raw))
    })
  }, [])

  const setLocale = useCallback((l: UiLocale) => {
    setLoc(l)
    void AsyncStorage.setItem(STORAGE_KEY, l)
  }, [])

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])

  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>
}

export function useUiLocale() {
  const ctx = useContext(UiLocaleContext)
  if (!ctx) throw new Error("useUiLocale must be used within UiLocaleProvider")
  return ctx
}

/** Заголовок шапки по шляху (як у веб sidebar). */
export function dashboardScreenTitle(pathname: string, locale: UiLocale): string {
  const p = pathname.replace(/\/$/, "") || "/dashboard"
  if (p === "/dashboard/channel-gate") return t("channelGate", locale)
  if (p === "/dashboard") return t("overview", locale)
  const segments: { prefix: string; key: string }[] = [
    { prefix: "/dashboard/exams", key: "exams" },
    { prefix: "/dashboard/mistakes", key: "mistakes" },
    { prefix: "/dashboard/admission", key: "admission" },
    { prefix: "/dashboard/leaderboard", key: "leaderboard" },
    { prefix: "/dashboard/stats", key: "stats" },
    { prefix: "/dashboard/billing", key: "billing" },
    { prefix: "/dashboard/profile", key: "profile" },
  ]
  for (const { prefix, key } of segments) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return t(key, locale)
  }
  return "mytest"
}
