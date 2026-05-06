import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../api/hooks/useAuth';
import { api } from '../api/client';
import { Spinner } from '../components/common/Spinner';
import { AdvancedSEO } from '../components/seo/AdvancedSEO';
import { WhatsAppFab } from '../components/common/WhatsAppFab';
import { getWhatsAppUrl } from '../lib/whatsapp';
import { resolveMediaUrl } from '../lib/resolveMediaUrl';
import { type HeroSlide, type LandingRuntimeSettings, isModernSlide } from '@bilimland/shared';
import './landing.css';

type Lang = 'ru' | 'kk' | 'en';
type ScoreKey = 'mathLit' | 'readingLit' | 'history' | 'profile1' | 'profile2';

const SCORE_LIMITS: Record<ScoreKey, number> = {
  mathLit: 10,
  readingLit: 10,
  history: 20,
  profile1: 50,
  profile2: 50,
};

const DEFAULT_SCORES: Record<ScoreKey, number> = {
  mathLit: 8,
  readingLit: 7,
  history: 14,
  profile1: 38,
  profile2: 32,
};

const COPY = {
  ru: {
    seoTitle: 'MyTest — пробный ЕНТ онлайн',
    seoDescription: 'Пробный ЕНТ онлайн с таймером, анализом ошибок и калькулятором шансов на грант.',
    nav: ['Каталог', 'Калькулятор', 'Тарифы'],
    login: 'Войти',
    freeTag: '2 теста бесплатно · без карты',
    heroTitle: <>Пробный <em>ЕНТ</em> онлайн —<br />как настоящий экзамен</>,
    heroSub: <>Таймер, анализ ошибок и калькулятор шансов на грант.<br />Подготовка к ЕНТ, НИШ, НУЭТ и БИЛ.</>,
    start: 'Начать бесплатный тест',
    demo: 'Смотреть демо',
    note: 'Вход через Telegram — 30 секунд',
    photoAlt: 'Фото ученика с медалью/дипломом',
    avgBadge: 'средний балл выпускников',
    proof: [
      ['1 200+', 'прошли пробный ЕНТ'],
      ['108', 'средний балл пользователей'],
      ['ЕНТ · НИШ · НУЭТ · БИЛ', 'форматы тестирования'],
    ],
    calcLabel: 'Калькулятор баллов',
    calcTitle: 'Узнай шансы на грант прямо сейчас',
    calcSub: 'Введи свои баллы — покажем, на какие специальности ты проходишь',
    profileSubjects: 'Профильные предметы',
    quota: 'Квота',
    quotaValue: 'Без квоты (грант)',
    subjects: {
      mathLit: 'Математическая грамотность',
      readingLit: 'Грамотность чтения',
      history: 'История Казахстана',
      profile1: 'Физика',
      profile2: 'Математика',
    },
    total: 'Сумма баллов',
    list: 'Смотреть список',
    passMany: (count: number) => `Проходите на ${count} направлений`,
    passHard: 'Порог пройден, конкурс высокий',
    fail: 'Пока не проходите',
    catalogLabel: 'Каталог',
    catalogTitle: 'Выбери формат теста',
    popular: 'Популярно',
    tests: [
      ['Пробный ЕНТ', 'Полный формат с таймером. Все 5 предметов как в настоящем экзамене.', ['120 вопросов', '240 мин', 'до 140 баллов'], 'Начать бесплатно'],
      ['Подготовка к НИШ', '6 предметов, полный формат вступительного экзамена.', ['180 вопросов', '240 мин', 'до 1500 баллов'], 'Начать тест'],
      ['Подготовка к БИЛ', '2 предмета, формат вступительного тестирования.', ['60 вопросов', '110 мин', 'до 240 баллов'], 'Начать тест'],
    ],
    stepsLabel: 'Как это работает',
    stepsTitle: 'Три шага до первого теста',
    steps: [
      ['Войди через Telegram', 'Открой бота, укажи номер — код придёт в Telegram за 10 секунд.'],
      ['Выбери экзамен', 'ЕНТ, НИШ или БИЛ. Настрой профильные предметы и запусти сессию.'],
      ['Разбери ошибки', 'Тематический анализ, правильные ответы и слабые места — сразу после теста.'],
    ],
    reviewsLabel: 'Отзывы',
    reviewsTitle: 'Говорят ученики',
    reviews: [
      ['СЖ', 'Самгат Жумали', '11 класс · Алматы', 'Итоговый балл ЕНТ: 127', 'Сложность максимально приближена к реальному экзамену. Вопросы на январском ЕНТ были похожи на пробные здесь.'],
      ['НО', 'Нарбек Оразбек', 'Репетитор · Астана', '10 учеников прошли тест', 'Ученикам нравится удобство и интерфейс. При повторных тестах минимальное повторение вопросов — это важно.'],
    ],
    pricingLabel: 'Тарифы',
    pricingTitle: 'Начни бесплатно',
    freeTitle: '2 полных теста — бесплатно',
    freeSub: 'Без карты. Без ограничений по времени. Полный формат.',
    startNow: 'Начать сейчас',
    prices: [
      ['Пробный', '750 ₸', '/ 1 тест', ['1 полный тест', 'Разбор ошибок', 'Статистика попытки']],
      ['Месяц', '3 900 ₸', '/ 30 дней', ['Все тесты без лимита', 'Полный трекинг прогресса', 'Аналитика по темам']],
      ['Год', '28 000 ₸', '/ 365 дней', ['Всё из «Месяца»', 'Все обновления каталога', 'Лучшая цена за день']],
    ],
    footerTagline: 'Подготовка к экзамену — без хаоса',
  },
  kk: {
    seoTitle: 'MyTest — онлайн сынақ ҰБТ',
    seoDescription: 'Таймері, қате талдауы және грант мүмкіндігін есептейтін онлайн сынақ ҰБТ.',
    nav: ['Каталог', 'Калькулятор', 'Тарифтер'],
    login: 'Кіру',
    freeTag: '2 тест тегін · карта қажет емес',
    heroTitle: <>Онлайн сынақ <em>ҰБТ</em> —<br />нағыз емтихан сияқты</>,
    heroSub: <>Таймер, қателерді талдау және грант мүмкіндігін есептеу.<br />ҰБТ, НЗМ, NUET және БИЛ-ға дайындық.</>,
    start: 'Тегін тест бастау',
    demo: 'Демо көру',
    note: 'Telegram арқылы кіру — 30 секунд',
    photoAlt: 'Медаль/диплом ұстаған оқушы суреті',
    avgBadge: 'түлектердің орташа балы',
    proof: [
      ['1 200+', 'сынақ ҰБТ тапсырды'],
      ['108', 'қолданушылардың орташа балы'],
      ['ҰБТ · НЗМ · NUET · БИЛ', 'тестілеу форматтары'],
    ],
    calcLabel: 'Балл калькуляторы',
    calcTitle: 'Грант мүмкіндігін қазір біл',
    calcSub: 'Баллдарыңды енгіз — қай мамандықтарға өтетініңді көрсетеміз',
    profileSubjects: 'Бейіндік пәндер',
    quota: 'Квота',
    quotaValue: 'Квотасыз (грант)',
    subjects: {
      mathLit: 'Математикалық сауаттылық',
      readingLit: 'Оқу сауаттылығы',
      history: 'Қазақстан тарихы',
      profile1: 'Физика',
      profile2: 'Математика',
    },
    total: 'Жалпы балл',
    list: 'Тізімді көру',
    passMany: (count: number) => `${count} бағытқа өтесіз`,
    passHard: 'Шектік балл өтті, конкурс жоғары',
    fail: 'Әзірге өтпейсіз',
    catalogLabel: 'Каталог',
    catalogTitle: 'Тест форматын таңда',
    popular: 'Танымал',
    tests: [
      ['Сынақ ҰБТ', 'Таймері бар толық формат. Нағыз емтихандағыдай 5 пән.', ['120 сұрақ', '240 мин', '140 балға дейін'], 'Тегін бастау'],
      ['НЗМ-ға дайындық', '6 пән, қабылдау емтиханының толық форматы.', ['180 сұрақ', '240 мин', '1500 балға дейін'], 'Тест бастау'],
      ['БИЛ-ға дайындық', '2 пән, қабылдау тестілеу форматы.', ['60 сұрақ', '110 мин', '240 балға дейін'], 'Тест бастау'],
    ],
    stepsLabel: 'Қалай жұмыс істейді',
    stepsTitle: 'Алғашқы тестке дейін үш қадам',
    steps: [
      ['Telegram арқылы кір', 'Ботты ашып, нөмірді көрсет — код Telegram-ға 10 секундта келеді.'],
      ['Емтиханды таңда', 'ҰБТ, НЗМ немесе БИЛ. Бейіндік пәндерді баптап, сессияны баста.'],
      ['Қателерді талда', 'Тақырыптық талдау, дұрыс жауаптар және әлсіз тұстар — тесттен кейін бірден.'],
    ],
    reviewsLabel: 'Пікірлер',
    reviewsTitle: 'Оқушылар не дейді',
    reviews: [
      ['СЖ', 'Самғат Жұмалы', '11 сынып · Алматы', 'ҰБТ қорытынды балы: 127', 'Күрделілігі нағыз емтиханға өте жақын. Қаңтардағы ҰБТ сұрақтары мұндағы сынақтарға ұқсас болды.'],
      ['НО', 'Нарбек Оразбек', 'Репетитор · Астана', '10 оқушы тест тапсырды', 'Оқушыларға ыңғайлылығы мен интерфейсі ұнайды. Қайталап тапсырғанда сұрақтардың аз қайталануы маңызды.'],
    ],
    pricingLabel: 'Тарифтер',
    pricingTitle: 'Тегін баста',
    freeTitle: '2 толық тест — тегін',
    freeSub: 'Картасыз. Уақыт шектеусіз. Толық формат.',
    startNow: 'Қазір бастау',
    prices: [
      ['Сынақ', '750 ₸', '/ 1 тест', ['1 толық тест', 'Қате талдауы', 'Әрекет статистикасы']],
      ['Ай', '3 900 ₸', '/ 30 күн', ['Барлық тесттер лимитсіз', 'Прогресті толық бақылау', 'Тақырыптар бойынша аналитика']],
      ['Жыл', '28 000 ₸', '/ 365 күн', ['«Айдағының» бәрі', 'Каталогтың барлық жаңартуы', 'Күнге шаққандағы тиімді баға']],
    ],
    footerTagline: 'Емтиханға дайындық — ретімен',
  },
  en: {
    seoTitle: 'MyTest — online UNT practice test',
    seoDescription: 'Online UNT practice tests with timer, mistake review, and grant chance calculator.',
    nav: ['Catalog', 'Calculator', 'Pricing'],
    login: 'Log in',
    freeTag: '2 free tests · no card',
    heroTitle: <>Online practice <em>UNT</em> —<br />like the real exam</>,
    heroSub: <>Timer, mistake analysis, and a grant chance calculator.<br />Prep for UNT, NIS, NUET, and BIL.</>,
    start: 'Start a free test',
    demo: 'Watch demo',
    note: 'Telegram login — 30 seconds',
    photoAlt: 'Student with medal or diploma photo',
    avgBadge: 'average graduate score',
    proof: [
      ['1 200+', 'completed a practice UNT'],
      ['108', 'average user score'],
      ['UNT · NIS · NUET · BIL', 'testing formats'],
    ],
    calcLabel: 'Score calculator',
    calcTitle: 'Check your grant chances now',
    calcSub: 'Enter your scores and see which programs you can pass',
    profileSubjects: 'Profile subjects',
    quota: 'Quota',
    quotaValue: 'No quota (grant)',
    subjects: {
      mathLit: 'Mathematical literacy',
      readingLit: 'Reading literacy',
      history: 'History of Kazakhstan',
      profile1: 'Physics',
      profile2: 'Mathematics',
    },
    total: 'Total score',
    list: 'View list',
    passMany: (count: number) => `You pass ${count} directions`,
    passHard: 'Threshold passed, competition is high',
    fail: 'Not passing yet',
    catalogLabel: 'Catalog',
    catalogTitle: 'Choose a test format',
    popular: 'Popular',
    tests: [
      ['Practice UNT', 'Full timed format. All 5 subjects just like the real exam.', ['120 questions', '240 min', 'up to 140 points'], 'Start free'],
      ['NIS preparation', '6 subjects, full entrance exam format.', ['180 questions', '240 min', 'up to 1500 points'], 'Start test'],
      ['BIL preparation', '2 subjects, entrance testing format.', ['60 questions', '110 min', 'up to 240 points'], 'Start test'],
    ],
    stepsLabel: 'How it works',
    stepsTitle: 'Three steps to your first test',
    steps: [
      ['Log in via Telegram', 'Open the bot, enter your number, and get the code in Telegram in 10 seconds.'],
      ['Choose an exam', 'UNT, NIS, or BIL. Set profile subjects and launch a session.'],
      ['Review mistakes', 'Topic analysis, correct answers, and weak spots right after the test.'],
    ],
    reviewsLabel: 'Reviews',
    reviewsTitle: 'Students say',
    reviews: [
      ['SZ', 'Samgat Zhumali', 'Grade 11 · Almaty', 'Final UNT score: 127', 'The difficulty is very close to the real exam. Questions on the January UNT were similar to the practice tests here.'],
      ['NO', 'Narbek Orazbek', 'Tutor · Astana', '10 students took the test', 'Students like the convenience and interface. Low question repetition in retakes matters a lot.'],
    ],
    pricingLabel: 'Pricing',
    pricingTitle: 'Start free',
    freeTitle: '2 full tests — free',
    freeSub: 'No card. No time limits. Full format.',
    startNow: 'Start now',
    prices: [
      ['Trial', '750 ₸', '/ 1 test', ['1 full test', 'Mistake review', 'Attempt statistics']],
      ['Month', '3 900 ₸', '/ 30 days', ['Unlimited tests', 'Full progress tracking', 'Topic analytics']],
      ['Year', '28 000 ₸', '/ 365 days', ['Everything in Month', 'All catalog updates', 'Best daily price']],
    ],
    footerTagline: 'Exam prep without chaos',
  },
} satisfies Record<Lang, Record<string, unknown>>;

function getHeroImage(slides: HeroSlide[] | undefined): string | null {
  const slide = slides?.find((item) => (item as { isActive?: boolean }).isActive !== false);
  if (!slide) return null;
  return resolveMediaUrl(isModernSlide(slide) ? slide.desktopImageUrl : slide.image);
}

export function LandingPage() {
  const { i18n } = useTranslation();
  const { user, isLoading } = useAuth();
  const [runtimeSettings, setRuntimeSettings] = useState<LandingRuntimeSettings | null>(null);
  const [runtimeSettingsLoaded, setRuntimeSettingsLoaded] = useState(false);
  const [scores, setScores] = useState(DEFAULT_SCORES);

  const language = (i18n.language === 'kk' || i18n.language === 'en' ? i18n.language : 'ru') as Lang;
  const copy = COPY[language];
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const directionCount = Math.max(1, Math.round((total - 70) / 3));
  const status = total >= 90 ? copy.passMany(directionCount) : total >= 70 ? copy.passHard : copy.fail;
  const whatsappHref = runtimeSettingsLoaded
    ? runtimeSettings?.whatsappUrl || getWhatsAppUrl() || 'https://wa.me/77775932124'
    : getWhatsAppUrl() || 'https://wa.me/77775932124';
  const heroImage = useMemo(() => getHeroImage(runtimeSettings?.heroSlides), [runtimeSettings?.heroSlides]);
  const demoHref = runtimeSettings?.instructionVideoUrl?.trim() || '#catalog';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<LandingRuntimeSettings>('/public/landing-settings')
      .then(({ data }) => {
        if (!cancelled) setRuntimeSettings(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRuntimeSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) return <Spinner fullScreen />;
  if (user) return <Navigate to="/app" replace />;

  return (
    <>
      <AdvancedSEO
        title={copy.seoTitle as string}
        description={copy.seoDescription as string}
        keywords="ЕНТ, пробный ЕНТ, ҰБТ, НИШ, БИЛ, MyTest"
        canonicalPath="/"
        htmlLang={language}
        i18nLanguage={language}
        ogImageAlt="MyTest"
      />
      <div className="mytest-lite">
        <nav className="mtl-nav">
          <Link to="/" className="mtl-logo"><span>My</span>Test</Link>
          <div className="mtl-nav-links">
            <a href="#catalog">{copy.nav[0]}</a>
            <a href="#calculator">{copy.nav[1]}</a>
            <a href="#pricing">{copy.nav[2]}</a>
          </div>
          <div className="mtl-nav-actions">
            <div className="mtl-lang" role="group" aria-label="Language">
              {(['ru', 'kk', 'en'] as const).map((lng) => (
                <button
                  key={lng}
                  type="button"
                  className={`mtl-lang-btn ${language === lng ? 'active' : ''}`}
                  onClick={() => i18n.changeLanguage(lng)}
                >
                  {lng === 'ru' ? 'РУС' : lng === 'kk' ? 'ҚАЗ' : 'ENG'}
                </button>
              ))}
            </div>
            <Link to="/login" className="mtl-nav-cta">{copy.login}</Link>
          </div>
        </nav>

        <main>
          <section className="mtl-hero">
            <div className="mtl-hero-left">
              <div className="mtl-hero-tag"><span />{copy.freeTag}</div>
              <h1 className="mtl-hero-h1">{copy.heroTitle}</h1>
              <p className="mtl-hero-sub">{copy.heroSub}</p>
              <div className="mtl-hero-btns">
                <Link to="/login" className="mtl-btn-primary">{copy.start}</Link>
                <a
                  href={demoHref}
                  className="mtl-btn-secondary"
                  target={demoHref.startsWith('http') ? '_blank' : undefined}
                  rel={demoHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {copy.demo}
                </a>
              </div>
              <div className="mtl-hero-note">{copy.note}</div>
            </div>
            <div className="mtl-hero-right">
              {heroImage ? (
                <img className="mtl-hero-photo" src={heroImage} alt={copy.photoAlt as string} />
              ) : (
                <div className="mtl-hero-img-placeholder" aria-label={copy.photoAlt as string}>
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                    <circle cx="20" cy="14" r="8" stroke="#378ADD" strokeWidth="1.5" />
                    <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="#378ADD" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <div>{copy.photoAlt}</div>
                </div>
              )}
              <div className="mtl-hero-badge">
                <div className="mtl-hero-badge-num">132</div>
                <div>{copy.avgBadge}</div>
              </div>
            </div>
          </section>

          <div className="mtl-social-proof">
            {copy.proof.map(([num, label]) => (
              <div className="mtl-sp-item" key={label}>
                <div className="mtl-sp-num">{num}</div>
                <div className="mtl-sp-label">{label}</div>
              </div>
            ))}
          </div>

          <section className="mtl-section" id="calculator">
            <div className="mtl-section-label">{copy.calcLabel}</div>
            <h2 className="mtl-section-title">{copy.calcTitle}</h2>
            <p className="mtl-section-sub">{copy.calcSub}</p>
            <div className="mtl-calc-box">
              <div className="mtl-calc-row">
                <label>
                  <span className="mtl-calc-label">{copy.profileSubjects}</span>
                  <select className="mtl-calc-select" defaultValue="physics-math">
                    <option value="physics-math">{copy.subjects.profile1} / {copy.subjects.profile2}</option>
                  </select>
                </label>
                <label>
                  <span className="mtl-calc-label">{copy.quota}</span>
                  <select className="mtl-calc-select" defaultValue="grant">
                    <option value="grant">{copy.quotaValue}</option>
                  </select>
                </label>
              </div>
              {(Object.keys(SCORE_LIMITS) as ScoreKey[]).map((key) => (
                <label className="mtl-slider-row" key={key}>
                  <span className="mtl-slider-header">
                    <span>{copy.subjects[key]}</span>
                    <strong>{scores[key]} / {SCORE_LIMITS[key]}</strong>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={SCORE_LIMITS[key]}
                    step="1"
                    value={scores[key]}
                    onChange={(event) => setScores((current) => ({ ...current, [key]: Number(event.target.value) }))}
                  />
                </label>
              ))}
              <div className="mtl-calc-result">
                <div>
                  <div className="mtl-calc-sum-label">{copy.total}</div>
                  <div className="mtl-calc-sum">{total} / 140</div>
                </div>
                <div className="mtl-calc-actions">
                  <span className={`mtl-calc-badge ${total >= 70 ? 'pass' : 'fail'}`}>{status}</span>
                  <Link to="/login" className="mtl-calc-list">{copy.list}</Link>
                </div>
              </div>
            </div>
          </section>

          <section className="mtl-section" id="catalog">
            <div className="mtl-section-label">{copy.catalogLabel}</div>
            <h2 className="mtl-section-title">{copy.catalogTitle}</h2>
            <div className="mtl-catalog-grid">
              {(copy.tests as [string, string, string[], string][]).map(([title, desc, stats, cta], index) => (
                <article className={`mtl-cat-card ${index === 0 ? 'featured' : ''}`} key={title}>
                  {index === 0 ? <div className="mtl-cat-pop">{copy.popular}</div> : null}
                  <div className="mtl-cat-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M5 8h6M5 5.5h6M5 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <h3 className="mtl-cat-title">{title}</h3>
                  <p className="mtl-cat-desc">{desc}</p>
                  <div className="mtl-cat-stats">
                    {stats.map((stat) => <span className="mtl-cat-stat" key={stat}>{stat}</span>)}
                  </div>
                  <Link to="/login" className="mtl-cat-btn">{cta}</Link>
                </article>
              ))}
            </div>
          </section>

          <section className="mtl-section mtl-steps-section">
            <div className="mtl-section-label">{copy.stepsLabel}</div>
            <h2 className="mtl-section-title">{copy.stepsTitle}</h2>
            <div className="mtl-steps-grid">
              {copy.steps.map(([title, desc], index) => (
                <article className="mtl-step" key={title}>
                  <div className="mtl-step-num">{index + 1}</div>
                  <h3 className="mtl-step-title">{title}</h3>
                  <p className="mtl-step-desc">{desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mtl-section">
            <div className="mtl-section-label">{copy.reviewsLabel}</div>
            <h2 className="mtl-section-title">{copy.reviewsTitle}</h2>
            <div className="mtl-reviews-grid">
              {copy.reviews.map(([initials, name, meta, score, text]) => (
                <article className="mtl-review-card" key={name}>
                  <div className="mtl-review-header">
                    <div className="mtl-review-avatar">{initials}</div>
                    <div>
                      <h3 className="mtl-review-name">{name}</h3>
                      <div className="mtl-review-meta">{meta}</div>
                    </div>
                  </div>
                  <div className="mtl-review-score">{score}</div>
                  <p className="mtl-review-text">«{text}»</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mtl-section" id="pricing">
            <div className="mtl-section-label">{copy.pricingLabel}</div>
            <h2 className="mtl-section-title">{copy.pricingTitle}</h2>
            <div className="mtl-pricing-free">
              <div>
                <div className="mtl-pricing-free-text">{copy.freeTitle}</div>
                <div className="mtl-pricing-free-sub">{copy.freeSub}</div>
              </div>
              <Link to="/login" className="mtl-pricing-free-btn">{copy.startNow}</Link>
            </div>
            <div className="mtl-pricing-grid">
              {(copy.prices as [string, string, string, string[]][]).map(([name, price, period, features], index) => (
                <article className={`mtl-price-card ${index === 1 ? 'featured' : ''}`} key={name}>
                  {index === 1 ? <div className="mtl-price-pop">{copy.popular}</div> : null}
                  <div className="mtl-price-label">{name}</div>
                  <div className="mtl-price-num">{price} <span>{period}</span></div>
                  <div className="mtl-price-features">
                    {features.map((feature) => (
                      <div className="mtl-price-feat" key={feature}>
                        <span />
                        <p>{feature}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

        <footer className="mtl-footer">
          <div>
            <div className="mtl-footer-logo"><span>My</span>Test</div>
            <div className="mtl-footer-tagline">{copy.footerTagline}</div>
          </div>
          <div className="mtl-footer-links">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <span>·</span>
            <a href={runtimeSettings?.instagramUrl || '#'}>Instagram</a>
            <span>·</span>
            <a href={runtimeSettings?.tiktokUrl || '#'}>TikTok</a>
            <span>·</span>
            <a href="mailto:mytest.info.kz@gmail.com">mytest.info.kz@gmail.com</a>
          </div>
        </footer>
      </div>
      <WhatsAppFab layout="landing" />
    </>
  );
}
