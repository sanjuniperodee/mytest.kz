import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setThemePreference, type ThemePreference } from '../../lib/theme';

type Proof = { title: string; body: string };
type Step = { title: string; body: string };
type Bento = { title: string; body: string };
type Faq = { question: string; answer: string };

export type LandingV3Props = {
  whatsappHref: string;
};

function trackThemeFromDoc(): { effective: 'light' | 'dark'; preference: ThemePreference } {
  const attr = document.documentElement.getAttribute('data-theme');
  const effective: 'light' | 'dark' = attr === 'light' ? 'light' : 'dark';
  try {
    const raw = localStorage.getItem('mytest-theme');
    const preference: ThemePreference =
      raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'dark';
    return { effective, preference };
  } catch {
    return { effective, preference: 'dark' };
  }
}

function cycleTheme() {
  const { effective, preference } = trackThemeFromDoc();
  if (preference === 'system') {
    setThemePreference(effective === 'dark' ? 'light' : 'dark');
    return;
  }
  setThemePreference(effective === 'dark' ? 'light' : 'dark');
}

// Decorative SVG components for visual interest
function GridPattern({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.15"/>
        </pattern>
      </defs>
      <rect width="400" height="400" fill="url(#grid)" />
    </svg>
  );
}

export function LandingV3({ whatsappHref }: LandingV3Props) {
  const { t, i18n } = useTranslation();
  const [isDark, setIsDark] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [heroCarouselIndex, setHeroCarouselIndex] = useState(0);
  const [heroCarouselPaused, setHeroCarouselPaused] = useState(false);

  // Hero image carousel slides
  const heroCarouselSlides = [
    {
      image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&h=900&fit=crop',
      title: i18n.language === 'ru' ? 'Готовься к ЕНТ \nс уверенностью' : i18n.language === 'kk' ? 'Сеніммен ЕНТ-ке \nдайындал' : 'Prepare for UNT \nwith confidence',
      subtitle: i18n.language === 'ru' ? 'Платформа с анализом ошибок и персональными рекомендациями' : i18n.language === 'kk' ? 'Қателерді талдау және жеке ұсыныстары бар платформа' : 'Platform with error analysis and personalized recommendations',
      cta: i18n.language === 'ru' ? 'Начать бесплатно' : i18n.language === 'kk' ? 'Тегін бастау' : 'Start free',
    },
    {
      image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1600&h=900&fit=crop',
      title: i18n.language === 'ru' ? 'Отслеживай \nсвой прогресс' : i18n.language === 'kk' ? 'Өз прогрессіңізді \nбақылаңыз' : 'Track your \nprogress',
      subtitle: i18n.language === 'ru' ? 'Детальная статистика по каждому предмету и теме' : i18n.language === 'kk' ? 'Әрбір пән мен тақырып бойынша толық статистика' : 'Detailed statistics for each subject and topic',
      cta: i18n.language === 'ru' ? 'Попробовать' : i18n.language === 'kk' ? 'Қолдану' : 'Try it',
    },
    {
      image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&h=900&fit=crop',
      title: i18n.language === 'ru' ? 'Поступай \nна грант' : i18n.language === 'kk' ? 'Грантқа \nөтіңіз' : 'Get into \nuniversity',
      subtitle: i18n.language === 'ru' ? 'Тысячи учеников уже достигли своих целей' : i18n.language === 'kk' ? 'Мыңдаған оқушылар өз мақсаттарына жетті' : 'Thousands of students have already achieved their goals',
      cta: i18n.language === 'ru' ? 'Присоединиться' : i18n.language === 'kk' ? 'Қатысу' : 'Join now',
    },
  ];

  // Auto-play hero carousel
  useEffect(() => {
    if (heroCarouselPaused || heroCarouselSlides.length <= 1) return;
    const timer = setInterval(() => {
      setHeroCarouselIndex((prev) => (prev + 1) % heroCarouselSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroCarouselPaused, heroCarouselSlides.length]);

  // Carousel data
  const carouselSlides = [
    {
      avatar: 'А',
      name: i18n.language === 'ru' ? 'Айгуль М.' : i18n.language === 'kk' ? 'Айгүл М.' : 'Aigul M.',
      role: i18n.language === 'ru' ? 'Ученица 11 класса' : i18n.language === 'kk' ? '11 сынып оқушысы' : '11th Grade Student',
      result: i18n.language === 'ru' ? 'Прошла на грант' : i18n.language === 'kk' ? 'грантқа өтті' : 'Got a grant',
      score: '128/140',
      subject: 'UNT',
      quote: i18n.language === 'ru' 
        ? 'Готовилась 3 месяца каждый день по 2 часа. Платформа показала точные темы, которые нужно повторить.'
        : i18n.language === 'kk'
        ? 'Күніне 2 сағаттен 3 ай бойы дайындалдым. Платформа қайталу керек тақырыптарды дәл көрсетті.'
        : 'Prepared for 3 months, 2 hours daily. The platform showed exactly which topics to review.',
    },
    {
      avatar: 'Д',
      name: i18n.language === 'ru' ? 'Дамир К.' : 'Damil K.',
      role: i18n.language === 'ru' ? 'Ученик 11 класса' : i18n.language === 'kk' ? '11 сынып оқушысы' : '11th Grade Student',
      result: i18n.language === 'ru' ? 'Прошёл на бюджет' : i18n.language === 'kk' ? 'грантқа өтті' : 'Government-funded',
      score: '135/140',
      subject: 'Математика',
      quote: i18n.language === 'ru'
        ? 'Вся подготовка заняла 2 месяца. Сначала прошёл пробный тест, потом работал над ошибками.'
        : i18n.language === 'kk'
        ? 'Барлық дайындық 2 айға созылды. Алдымен сынақ тестін өткіздім, содан кейін қателермен жұмыс істедім.'
        : 'Total prep took 2 months. First took a practice test, then worked on mistakes.',
    },
    {
      avatar: 'С',
      name: i18n.language === 'ru' ? 'Сауле Б.' : 'Saule B.',
      role: i18n.language === 'ru' ? 'Ученица 11 класса' : i18n.language === 'kk' ? '11 сынып оқушысы' : '11th Grade Student',
      result: i18n.language === 'ru' ? 'Получила грант' : i18n.language === 'kk' ? 'грант алды' : 'Received grant',
      score: '131/140',
      subject: 'Физика',
      quote: i18n.language === 'ru'
        ? 'Удобно, что можно заниматься в любое время. Вечером после школы или утром перед уроками.'
        : i18n.language === 'kk'
        ? 'Кез келген уақытта жаттығуға болады. Мектептен кейін кешке немесе сабақ алдында таңертең.'
        : 'Convenient that you can study anytime. Evening after school or morning before classes.',
    },
    {
      avatar: 'А',
      name: i18n.language === 'ru' ? 'Арман Р.' : 'Arman R.',
      role: i18n.language === 'ru' ? 'Ученик 11 класса' : i18n.language === 'kk' ? '11 сынып оқушысы' : '11th Grade Student',
      result: i18n.language === 'ru' ? 'Набрал 132 балла' : i18n.language === 'kk' ? '132 балл жинады' : 'Scored 132 points',
      score: '132/140',
      subject: 'Казахский язык',
      quote: i18n.language === 'ru'
        ? 'Благодаря анализу ошибок я понял свои слабые стороны и сфокусировался на них.'
        : i18n.language === 'kk'
        ? 'Қателерді талдау арқылы өзімнің әлсіз жақтарымды түсіндім және оларға бағытталдым.'
        : 'Thanks to error analysis, I understood my weak points and focused on them.',
    },
  ];

  useEffect(() => {
    const read = () => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    };
    read();
    const m = new MutationObserver(read);
    m.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', read);
    
    // Trigger hero animation after mount
    setTimeout(() => {}, 100);
    
    return () => {
      m.disconnect();
      window.removeEventListener('storage', read);
    };
  }, []);

  // Auto-play carousel
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused, carouselSlides.length]);

  const proof = useMemo(
    () => t('landingV3.proofItems', { returnObjects: true }) as Proof[],
    [t],
  );
  const steps = useMemo(
    () => t('landingV3.pipelineSteps', { returnObjects: true }) as Step[],
    [t],
  );
  const bento = useMemo(
    () => t('landingV3.bentoItems', { returnObjects: true }) as Bento[],
    [t],
  );
  const faq = useMemo(() => t('landingV3.faqItems', { returnObjects: true }) as Faq[], [t]);

  return (
    <div
      id="landing-v3-root"
      className={`${isDark ? 'dark' : ''} text-zinc-900 antialiased [font-feature-settings:"ss01","cv01"] selection:bg-violet-500/15 selection:text-inherit dark:text-zinc-100`}
    >
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-zinc-50/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 lg:px-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600">
                <span className="text-sm font-bold text-white">M</span>
              </div>
              <span className="text-base font-semibold tracking-tight">{t('landingV3.navBrand')}</span>
            </div>
            <nav className="hidden items-center gap-0.5 text-sm text-zinc-500 dark:text-zinc-400 lg:flex">
              <a href="#v3-sessions" className="rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100">
                {t('landingV3.navSessions')}
              </a>
              <a href="#v3-pipeline" className="rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100">
                {t('landingV3.navPipeline')}
              </a>
              <a href="#v3-bento" className="rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100">
                {t('landingV3.navBento')}
              </a>
              <a href="#v3-faq" className="rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100">
                {t('landingV3.navFaq')}
              </a>
            </nav>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cycleTheme}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200/90 bg-white text-zinc-600 transition-all hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
                aria-label={t('landingV3.themeToggle')}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {isDark ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  )}
                </svg>
              </button>
              <Link
                to="/login"
                className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-[0.99] dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                {t('landingV3.navCta')}
              </Link>
            </div>
          </div>
        </header>

        <main>
          {/* Hero Carousel Section */}
          <section 
            className="relative h-[85vh] min-h-[500px] overflow-hidden"
            onMouseEnter={() => setHeroCarouselPaused(true)}
            onMouseLeave={() => setHeroCarouselPaused(false)}
          >
            {/* Background images */}
            {heroCarouselSlides.map((slide, i) => (
              <div
                key={i}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  i === heroCarouselIndex ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <img
                  src={slide.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/80 via-zinc-900/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-transparent to-transparent" />
              </div>
            ))}
            
            {/* Content */}
            <div className="relative z-10 flex h-full items-center">
              <div className="mx-auto w-full max-w-7xl px-5 lg:px-8">
                <div className="max-w-2xl">
                  {heroCarouselSlides.map((slide, i) => (
                    <div
                      key={i}
                      className={`transition-all duration-700 ${
                        i === heroCarouselIndex 
                          ? 'opacity-100 translate-y-0' 
                          : 'opacity-0 translate-y-8 pointer-events-none absolute inset-0 flex items-center'
                      }`}
                    >
                      <div>
                        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl whitespace-pre-line">
                          {slide.title}
                        </h1>
                        <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-200">
                          {slide.subtitle}
                        </p>
                        <div className="mt-10">
                          <Link
                            to="/login"
                            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-white px-10 text-base font-semibold text-zinc-900 shadow-xl transition-all hover:bg-zinc-100 active:scale-[0.99]"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {slide.cta}
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Navigation dots */}
            <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-3">
              {heroCarouselSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHeroCarouselIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === heroCarouselIndex
                      ? 'w-10 bg-white shadow-lg'
                      : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            
            {/* Navigation arrows */}
            <button
              type="button"
              onClick={() => setHeroCarouselIndex((prev) => (prev - 1 + heroCarouselSlides.length) % heroCarouselSlides.length)}
              className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm text-white transition-all hover:bg-white/20 hover:scale-105 lg:left-8"
              aria-label="Previous slide"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setHeroCarouselIndex((prev) => (prev + 1) % heroCarouselSlides.length)}
              className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm text-white transition-all hover:bg-white/20 hover:scale-105 lg:right-8"
              aria-label="Next slide"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </section>

          {/* Stats Bar */}
          <section className="border-y border-zinc-200/80 bg-white/50 py-8 dark:border-zinc-800/80 dark:bg-zinc-900/20">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                <div className="text-center">
                  <p className="font-mono text-3xl font-bold text-violet-600 dark:text-violet-400">15K+</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Активных учеников</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-3xl font-bold text-emerald-600 dark:text-emerald-400">85%</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Поступили на грант</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-3xl font-bold text-fuchsia-600 dark:text-fuchsia-400">5M+</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Решенных тестов</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-3xl font-bold text-amber-600 dark:text-amber-400">4.9</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Рейтинг на Play Market</p>
                </div>
              </div>
            </div>
          </section>

          {/* Sessions/Proof Section */}
          <section
            id="v3-carousel"
            className="relative overflow-hidden px-5 py-16 lg:px-8"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div className="mx-auto max-w-7xl">
              <div className="mb-10 text-center">
                <span className="text-sm font-medium uppercase tracking-widest text-violet-600 dark:text-violet-400">
                  {i18n.language === 'ru' ? 'Отзывы учеников' : i18n.language === 'kk' ? 'Оқушылардың пікірлері' : 'Student Reviews'}
                </span>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
                  {i18n.language === 'ru' ? 'Истории успеха' : i18n.language === 'kk' ? 'Табыс хикаялары' : 'Success Stories'}
                </h2>
              </div>
              
              <div className="relative">
                {/* Decorative gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-50 via-transparent to-zinc-50 dark:from-zinc-950 dark:via-transparent dark:to-zinc-950 pointer-events-none" />
                
                <div className="relative overflow-hidden">
                  <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${activeSlide * 100}%)` }}
                  >
                    {carouselSlides.map((slide, i) => (
                      <div
                        key={i}
                        className="w-full flex-shrink-0"
                      >
                        <div className="mx-auto max-w-3xl">
                          <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-xl shadow-zinc-900/5 dark:border-zinc-800/80 dark:bg-zinc-900/40 sm:p-10">
                            {/* Quote icon */}
                            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 opacity-50 dark:from-violet-900/30 dark:to-fuchsia-900/30" />
                            <svg className="absolute right-6 top-6 h-8 w-8 text-violet-200 dark:text-violet-800" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                            </svg>
                            
                            <div className="relative">
                              <p className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-xl">
                                "{slide.quote}"
                              </p>
                              
                              <div className="mt-8 flex items-center gap-4">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-lg shadow-violet-500/25">
                                  {slide.avatar}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{slide.name}</p>
                                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{slide.role}</p>
                                </div>
                                <div className="shrink-0 rounded-xl border border-emerald-200/50 bg-emerald-50/50 px-4 py-2 dark:border-emerald-800/50 dark:bg-emerald-900/20">
                                  <p className="text-center font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">{slide.score}</p>
                                  <p className="text-center text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70">{slide.subject}</p>
                                </div>
                              </div>
                              
                              <div className="mt-4 flex items-center gap-2">
                                <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{slide.result}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Navigation dots */}
                <div className="mt-8 flex items-center justify-center gap-3">
                  {carouselSlides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveSlide(i)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        i === activeSlide
                          ? 'w-8 bg-violet-500 shadow-lg shadow-violet-500/50'
                          : 'w-2 bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600'
                      }`}
                      aria-label={`Go to slide ${i + 1}`}
                    />
                  ))}
                </div>
                
                {/* Navigation arrows */}
                <button
                  type="button"
                  onClick={() => setActiveSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length)}
                  className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/80 shadow-lg backdrop-blur-sm transition-all hover:bg-white hover:scale-105 dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:bg-zinc-900"
                  aria-label="Previous slide"
                >
                  <svg className="h-5 w-5 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlide((prev) => (prev + 1) % carouselSlides.length)}
                  className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/80 shadow-lg backdrop-blur-sm transition-all hover:bg-white hover:scale-105 dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:bg-zinc-900"
                  aria-label="Next slide"
                >
                  <svg className="h-5 w-5 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </section>

          {/* Sessions/Proof Section */}
          <section
            id="v3-sessions"
            className="relative border-y border-zinc-200/90 bg-white/50 py-20 dark:border-zinc-800/90 dark:bg-zinc-900/20"
          >
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <span className="text-sm font-medium uppercase tracking-widest text-violet-600 dark:text-violet-400">
                    {t('landingV3.proofKicker')}
                  </span>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                    {t('landingV3.proofTitle')}
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-px w-12 bg-zinc-300 dark:bg-zinc-700 lg:hidden" />
                  <p className="max-w-sm text-sm text-zinc-500 lg:text-right dark:text-zinc-400">
                    Real exam conditions, real progress tracking, real results.
                  </p>
                </div>
              </div>
              
              <div className="grid gap-6 md:grid-cols-3">
                {proof.map((item, i) => (
                  <article
                    key={item.title}
                    className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-8 transition-all duration-300 hover:border-violet-200/80 hover:shadow-xl hover:shadow-violet-500/5 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-violet-600/30"
                    style={{ transitionDelay: `${i * 50}ms` }}
                  >
                    {/* Card number */}
                    <span className="absolute -right-2 -top-2 font-display text-[120px] font-bold leading-none text-zinc-100/50 dark:text-zinc-900/50">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    
                    <div className="relative">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30">
                        {i === 0 && (
                          <svg className="h-6 w-6 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {i === 1 && (
                          <svg className="h-6 w-6 text-fuchsia-600 dark:text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {i === 2 && (
                          <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {item.body}
                      </p>
                    </div>
                    
                    <div className="mt-6 h-px w-full bg-gradient-to-r from-violet-500/0 via-violet-500/50 to-violet-500/0 transition-all group-hover:from-violet-500/50 group-hover:to-violet-500/50" />
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Pipeline Section - How It Works */}
          <section className="relative px-5 py-24 lg:px-8 lg:py-32" id="v3-pipeline">
            <div className="mx-auto max-w-7xl">
              <div className="mx-auto max-w-2xl text-center">
                <span className="text-sm font-medium uppercase tracking-widest text-violet-600 dark:text-violet-400">
                  {t('landingV3.pipelineKicker')}
                </span>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                  {t('landingV3.pipelineTitle')}
                </h2>
                <p className="mt-4 text-base text-zinc-500 dark:text-zinc-400">
                  {t('landingV3.pipelineSub')}
                </p>
              </div>
              
              {/* Connecting line */}
              <div className="mt-16 hidden lg:block">
                <div className="absolute left-1/2 top-[30%] h-px w-full bg-gradient-to-r from-transparent via-violet-200/50 to-transparent dark:via-violet-800/30" />
              </div>
              
              <ol className="relative grid gap-8 lg:grid-cols-3 lg:gap-12">
                {steps.map((s, i) => (
                  <li
                    key={s.title}
                    className="relative"
                  >
                    {/* Connector dot */}
                    <div className="absolute -left-4 top-8 hidden h-3 w-3 rounded-full border-2 border-violet-500 bg-white dark:bg-zinc-950 lg:block" />
                    
                    <div className="flex gap-6 lg:flex-col lg:items-center lg:text-center">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:h-20 lg:w-20">
                        <span className="font-mono text-xl font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      
                      <div className="flex-1 pt-2 lg:pt-4">
                        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                          {s.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {s.body}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Bento/Features Section */}
          <section
            id="v3-bento"
            className="relative border-y border-zinc-200/90 bg-zinc-100/40 py-24 dark:border-zinc-800/80 dark:bg-zinc-900/10"
          >
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <span className="text-sm font-medium uppercase tracking-widest text-violet-600 dark:text-violet-400">
                  {t('landingV3.bentoKicker')}
                </span>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                  {t('landingV3.bentoTitle')}
                </h2>
                <p className="mt-4 text-base text-zinc-500 dark:text-zinc-400">
                  {t('landingV3.bentoLead')}
                </p>
              </div>
              
              {/* Bento Grid - Asymmetric */}
              <div className="mt-12 grid auto-rows-min grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {bento.map((cell, i) => (
                  <div
                    key={cell.title}
                    className={`group relative min-h-[180px] rounded-2xl border border-zinc-200/80 bg-white p-6 transition-all duration-300 hover:border-violet-300/50 hover:shadow-lg dark:border-zinc-800/90 dark:bg-zinc-950/50 dark:hover:border-violet-600/25 ${
                      i === 0 ? 'lg:col-span-2' : ''
                    } ${i === 3 ? 'lg:col-span-2' : ''} ${i === 4 ? 'lg:row-span-2' : ''}`}
                  >
                    <div className="flex h-full flex-col">
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 transition-colors group-hover:bg-violet-100 dark:bg-zinc-900 dark:group-hover:bg-violet-900/30">
                        {i === 0 && (
                          <svg className="h-5 w-5 text-zinc-600 transition-colors group-hover:text-violet-600 dark:text-zinc-400 dark:group-hover:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        )}
                        {i === 1 && (
                          <svg className="h-5 w-5 text-zinc-600 transition-colors group-hover:text-violet-600 dark:text-zinc-400 dark:group-hover:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {i === 2 && (
                          <svg className="h-5 w-5 text-zinc-600 transition-colors group-hover:text-violet-600 dark:text-zinc-400 dark:group-hover:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 3.143L13 21l-2.286-6.857L5 12l5.714-3.143L13 3z" />
                          </svg>
                        )}
                        {i === 3 && (
                          <svg className="h-5 w-5 text-zinc-600 transition-colors group-hover:text-violet-600 dark:text-zinc-400 dark:group-hover:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                        {i === 4 && (
                          <svg className="h-5 w-5 text-zinc-600 transition-colors group-hover:text-violet-600 dark:text-zinc-400 dark:group-hover:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        )}
                        {i === 5 && (
                          <svg className="h-5 w-5 text-zinc-600 transition-colors group-hover:text-violet-600 dark:text-zinc-400 dark:group-hover:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                        )}
                      </div>
                      
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {cell.title}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {cell.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Admit/CTA Section */}
          <section className="relative px-5 py-24 lg:px-8 lg:py-32" id="v3-admit">
            <div className="mx-auto max-w-7xl">
              <div className="overflow-hidden rounded-3xl border border-dashed border-violet-400/40 bg-gradient-to-br from-violet-50/80 via-white to-fuchsia-50/40 p-10 dark:border-violet-600/30 dark:from-violet-950/30 dark:via-zinc-950 dark:to-fuchsia-950/20 sm:p-16">
                <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
                  <div className="relative">
                    {/* Decorative element */}
                    <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-violet-200/30 blur-2xl dark:bg-violet-600/10" />
                    
                    <span className="relative text-sm font-medium uppercase tracking-widest text-violet-600 dark:text-violet-400">
                      {t('landingV3.admitKicker')}
                    </span>
                    <h2 className="relative mt-3 font-display text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                      {t('landingV3.admitTitle')}
                    </h2>
                    <p className="relative mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {t('landingV3.admitBody')}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-start gap-4">
                    {/* Decorative stats */}
                    <div className="grid w-full grid-cols-3 gap-4">
                      <div className="rounded-xl border border-zinc-200/50 bg-white/60 p-4 text-center dark:border-zinc-800/50 dark:bg-zinc-900/30">
                        <p className="font-mono text-2xl font-semibold text-violet-600 dark:text-violet-400">140</p>
                        <p className="mt-1 text-xs text-zinc-500">max points</p>
                      </div>
                      <div className="rounded-xl border border-zinc-200/50 bg-white/60 p-4 text-center dark:border-zinc-800/50 dark:bg-zinc-900/30">
                        <p className="font-mono text-2xl font-semibold text-fuchsia-600 dark:text-fuchsia-400">5</p>
                        <p className="mt-1 text-xs text-zinc-500">subjects</p>
                      </div>
                      <div className="rounded-xl border border-zinc-200/50 bg-white/60 p-4 text-center dark:border-zinc-800/50 dark:bg-zinc-900/30">
                        <p className="font-mono text-2xl font-semibold text-emerald-600 dark:text-emerald-400">4h</p>
                        <p className="mt-1 text-xs text-zinc-500">duration</p>
                      </div>
                    </div>
                    
                    <Link
                      to="/login"
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-8 text-sm font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 active:scale-[0.99] sm:w-auto dark:bg-white dark:text-zinc-900"
                    >
                      {t('landingV3.admitCta')}
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">{t('landingV3.admitNote')}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section
            id="v3-faq"
            className="relative border-t border-zinc-200/90 bg-white/30 py-24 dark:border-zinc-800/80 dark:bg-zinc-900/20"
          >
            <div className="mx-auto max-w-3xl px-5 lg:px-8">
              <div className="text-center">
                <h2 className="font-display text-3xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                  {t('landingV3.faqTitle')}
                </h2>
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">
                  {t('landingV3.faqLead')}
                </p>
              </div>
              
              <div className="mt-12 space-y-3">
                {faq.map((f, i) => (
                  <div
                    key={f.question}
                    className={`overflow-hidden rounded-xl border transition-all duration-300 ${
                      openFaq === i
                        ? 'border-violet-200/80 bg-violet-50/50 dark:border-violet-800/50 dark:bg-violet-950/30'
                        : 'border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-800/80 dark:bg-zinc-950/40 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left sm:p-6"
                    >
                      <span className="text-sm font-medium text-zinc-900 sm:text-base dark:text-zinc-100">
                        {f.question}
                      </span>
                      <span className={`shrink-0 text-zinc-400 transition-transform duration-300 ${
                        openFaq === i ? 'rotate-180' : ''
                      }`}>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ${
                      openFaq === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-600 sm:px-6 sm:pb-6 dark:text-zinc-400">
                        {f.answer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Closing CTA */}
          <section className="relative px-5 py-24 lg:px-8 lg:py-32" id="v3-close">
            <div className="mx-auto max-w-4xl">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 px-8 py-16 text-center sm:px-12 sm:py-20 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
                {/* Decorative elements */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl" />
                  <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-fuchsia-600/20 blur-3xl" />
                </div>
                
                {/* Grid pattern overlay */}
                <div className="absolute inset-0 opacity-10">
                  <GridPattern className="h-full w-full text-zinc-500" />
                </div>
                
                <div className="relative">
                  <h2 className="font-display text-3xl font-semibold text-balance text-white sm:text-4xl lg:text-5xl">
                    {t('landingV3.closingTitle')}
                  </h2>
                  <p className="mx-auto mt-4 max-w-lg text-base text-zinc-400">
                    {t('landingV3.closingSub')}
                  </p>
                  
                  <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                    <Link
                      to="/login"
                      className="group inline-flex h-14 items-center justify-center gap-3 rounded-xl bg-white px-10 text-base font-semibold text-zinc-900 transition-all hover:bg-zinc-100 active:scale-[0.99]"
                    >
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.58.295-.002.003 0 0 0 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                      </svg>
                      {t('landingV3.closingCta')}
                    </Link>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-zinc-700/50 bg-white/5 px-8 text-base font-medium text-white backdrop-blur-sm transition-all hover:bg-white/10"
                    >
                      <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-200/90 py-10 dark:border-zinc-800/80">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 lg:px-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600">
                <span className="text-sm font-bold text-white">M</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('landingV3.navBrand')}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">{t('landingV3.footerRights')}</p>
              </div>
            </div>
            
            <a
              href={whatsappHref}
              className="flex items-center gap-2 text-sm text-zinc-600 transition-colors hover:text-green-600 dark:text-zinc-400 dark:hover:text-green-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {t('landingV3.footerWa')}
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
