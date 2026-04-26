import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setThemePreference, type ThemePreference } from '../../lib/theme';

type Proof = { title: string; body: string };
type Step = { title: string; body: string };
type Bento = { title: string; body: string };
type Faq = { question: string; answer: string };
type PriceFeature = { text: string; included: boolean };
type PriceTier = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: PriceFeature[];
  cta: string;
  highlighted: boolean;
};
type Testimonial = {
  name: string;
  city: string;
  school: string;
  score: string;
  subject: string;
  result: string;
  quote: string;
  initials: string;
};

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

// Intersection Observer Hook
function useInView(options = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.1, ...options });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isInView };
}

// Animated Counter Component
function AnimatedCounter({ target, suffix = '', duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const { ref, isInView } = useInView();
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (isInView && !hasAnimated.current) {
      hasAnimated.current = true;
      const steps = 60;
      const increment = target / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          setCount(target);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [isInView, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// Section Wrapper with fade-in animation
function Section({ children, className = '', id = '', onMouseEnter, onMouseLeave }: { children: React.ReactNode; className?: string; id?: string; onMouseEnter?: () => void; onMouseLeave?: () => void }) {
  const { ref, isInView } = useInView();

  return (
    <section
      id={id}
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`transition-all duration-700 ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </section>
  );
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

  // Testimonials data (V4 style)
  const testimonials: Testimonial[] = useMemo(() => [
    {
      name: i18n.language === 'ru' ? 'Айгуль Молдабаева' : 'Айгүл Молдабаева',
      city: i18n.language === 'ru' ? 'Алматы' : 'Алматы',
      school: i18n.language === 'ru' ? 'Школа-лицей №126' : '№126 лицей мектебі',
      score: '128/140',
      subject: 'UNT',
      result: i18n.language === 'ru' ? 'Грант, КБТУ' : 'грант, КБТУ',
      initials: 'АМ',
      quote: i18n.language === 'ru'
        ? 'Готовилась 3 месяца. Платформа точно показала, над какими темами работать. После разбора ошибок стало намного понятнее.'
        : '3 ай дайындалдым. Платформа қай тақырыптармен жұмыс істеу керек екенін дәл көрсетті.',
    },
    {
      name: i18n.language === 'ru' ? 'Дамир Каримов' : 'Дәмір Кәрімов',
      city: i18n.language === 'ru' ? 'Астана' : 'Астана',
      school: i18n.language === 'ru' ? 'НИШ ФМН' : 'NIS FMH',
      score: '135/140',
      subject: i18n.language === 'ru' ? 'Математика' : 'Математика',
      result: i18n.language === 'ru' ? 'Бюджет, МГУ' : 'бюджет, МГУ',
      initials: 'ДК',
      quote: i18n.language === 'ru'
        ? 'Прошёл все пробники за месяц до экзамена. Сначала набирал 100-110, потом стабильно 130+.'
        : 'Емтиханға бір ай қалғанша барлық сынақ тесттерін өткіздім.',
    },
    {
      name: i18n.language === 'ru' ? 'Сауле Баяхова' : 'Сәуле Баяхова',
      city: i18n.language === 'ru' ? 'Шымкент' : 'Шымкент',
      school: i18n.language === 'ru' ? 'Гимназия №8' : '№8 гимназия',
      score: '131/140',
      subject: i18n.language === 'ru' ? 'Физика' : 'Физика',
      result: i18n.language === 'ru' ? 'Грант, КазНУ' : 'грант, ҚазҰУ',
      initials: 'СБ',
      quote: i18n.language === 'ru'
        ? 'Занималась вечерами после школы. Удобно, что не привязана к расписанию репетитора.'
        : 'Мектептен кейін кешке жаттықтым. Репетитор кестесіне байланысты емес, ыңғайлы.',
    },
  ], [i18n.language]);

  // Pricing data
  const pricingTiers: PriceTier[] = useMemo(() => [
    {
      name: i18n.language === 'ru' ? 'Пробный' : i18n.language === 'kk' ? 'Сынақ' : 'Trial',
      price: '0',
      period: '',
      description: i18n.language === 'ru' ? 'Попробовать платформу' : i18n.language === 'kk' ? 'Платформаны сынау' : 'Try the platform',
      features: [
        { text: i18n.language === 'ru' ? '2 полных пробных теста' : i18n.language === 'kk' ? '2 толық сынақ тест' : '2 full practice tests', included: true },
        { text: i18n.language === 'ru' ? 'Базовый разбор ошибок' : i18n.language === 'kk' ? 'Қателерді негізгі талдау' : 'Basic error analysis', included: true },
        { text: i18n.language === 'ru' ? 'Таймер и навигация' : i18n.language === 'kk' ? 'Таймер және навигация' : 'Timer and navigation', included: true },
        { text: i18n.language === 'ru' ? 'Подробные объяснения' : i18n.language === 'kk' ? 'Толық түсіндірмелер' : 'Detailed explanations', included: false },
        { text: i18n.language === 'ru' ? 'Сессии разбора ошибок' : i18n.language === 'kk' ? 'Қателерді талдау сессиялары' : 'Error analysis sessions', included: false },
        { text: i18n.language === 'ru' ? 'Отслеживание прогресса' : i18n.language === 'kk' ? 'Прогресті бақылау' : 'Progress tracking', included: false },
      ],
      cta: i18n.language === 'ru' ? 'Начать бесплатно' : i18n.language === 'kk' ? 'Тегін бастау' : 'Start free',
      highlighted: false,
    },
    {
      name: i18n.language === 'ru' ? 'Месяц' : i18n.language === 'kk' ? 'Ай' : 'Month',
      price: '4 900',
      period: i18n.language === 'ru' ? 'тенге / месяц' : i18n.language === 'kk' ? 'теңге / ай' : 'KZT / month',
      description: i18n.language === 'ru' ? 'Для интенсивной подготовки' : i18n.language === 'kk' ? 'Интенсивті дайындық үшін' : 'For intensive prep',
      features: [
        { text: i18n.language === 'ru' ? 'Безлимитные тесты' : i18n.language === 'kk' ? 'Лимитсіз тесттер' : 'Unlimited tests', included: true },
        { text: i18n.language === 'ru' ? 'Подробные объяснения' : i18n.language === 'kk' ? 'Толық түсіндірмелер' : 'Detailed explanations', included: true },
        { text: i18n.language === 'ru' ? 'Сессии разбора ошибок' : i18n.language === 'kk' ? 'Қателерді талдау' : 'Error analysis', included: true },
        { text: i18n.language === 'ru' ? 'Прогресс и статистика' : i18n.language === 'kk' ? 'Прогресс пен статистика' : 'Progress & stats', included: true },
        { text: i18n.language === 'ru' ? 'Все форматы экзаменов' : i18n.language === 'kk' ? 'Барлық емтихан форматтары' : 'All exam formats', included: true },
        { text: i18n.language === 'ru' ? 'Все языки интерфейса' : i18n.language === 'kk' ? 'Барлық тілдер' : 'All interface languages', included: true },
      ],
      cta: i18n.language === 'ru' ? 'Выбрать' : i18n.language === 'kk' ? 'Таңдау' : 'Choose',
      highlighted: true,
    },
    {
      name: i18n.language === 'ru' ? 'Год' : i18n.language === 'kk' ? 'Жыл' : 'Year',
      price: '29 900',
      period: i18n.language === 'ru' ? 'тенге / год' : i18n.language === 'kk' ? 'теңге / жыл' : 'KZT / year',
      description: i18n.language === 'ru' ? 'Максимальная выгода' : i18n.language === 'kk' ? 'Максималды пайда' : 'Maximum value',
      features: [
        { text: i18n.language === 'ru' ? 'Всё из «Месяц»' : i18n.language === 'kk' ? '"Ай" дегендегінің бәрі' : 'Everything from "Month"', included: true },
        { text: i18n.language === 'ru' ? 'Экономия 50%' : i18n.language === 'kk' ? '50% үнемдеу' : 'Save 50%', included: true },
        { text: i18n.language === 'ru' ? 'Приоритетная поддержка' : i18n.language === 'kk' ? 'Басымдылықты қолдау' : 'Priority support', included: true },
        { text: i18n.language === 'ru' ? 'Ранний доступ к обновлениям' : i18n.language === 'kk' ? 'Жаңартуларға ерте қол жеткізу' : 'Early access to updates', included: true },
        { text: i18n.language === 'ru' ? 'Семейный доступ (до 3)' : i18n.language === 'kk' ? 'Отбасылық қол жеткізу (3-ке дейін)' : 'Family access (up to 3)', included: true },
        { text: i18n.language === 'ru' ? 'Возврат в течение 7 дней' : i18n.language === 'kk' ? '7 күн ішінде қайтару' : '7-day refund', included: true },
      ],
      cta: i18n.language === 'ru' ? 'Выбрать' : i18n.language === 'kk' ? 'Таңдау' : 'Choose',
      highlighted: false,
    },
  ], [i18n.language]);

  // Auto-play hero carousel
  useEffect(() => {
    if (heroCarouselPaused || heroCarouselSlides.length <= 1) return;
    const timer = setInterval(() => {
      setHeroCarouselIndex((prev) => (prev + 1) % heroCarouselSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroCarouselPaused, heroCarouselSlides.length]);

  useEffect(() => {
    const read = () => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    };
    read();
    const m = new MutationObserver(read);
    m.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', read);

    return () => {
      m.disconnect();
      window.removeEventListener('storage', read);
    };
  }, []);

  // Auto-play testimonials
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused, testimonials.length]);

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
              <a href="#v3-pricing" className="rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100">
                {t('landingV3.navPricing')}
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

          {/* Stats Bar — animated */}
          <section className="border-y border-zinc-200/80 bg-white/50 py-8 dark:border-zinc-800/80 dark:bg-zinc-900/20">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                <div className="text-center">
                  <p className="font-mono text-3xl font-bold text-violet-600 dark:text-violet-400">
                    <AnimatedCounter target={12847} suffix="+" />
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {i18n.language === 'ru' ? 'учеников сдали ЕНТ' : i18n.language === 'kk' ? 'оқушы емтихан тапсырды' : 'students took ENT'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    <AnimatedCounter target={94} suffix="%" />
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {i18n.language === 'ru' ? 'набрали грант' : i18n.language === 'kk' ? 'грант алды' : 'got grants'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-3xl font-bold text-fuchsia-600 dark:text-fuchsia-400">
                    <AnimatedCounter target={240000} suffix="+" />
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {i18n.language === 'ru' ? 'тестов пройдено' : i18n.language === 'kk' ? 'тест өткізілді' : 'tests completed'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-3xl font-bold text-amber-600 dark:text-amber-400">4.9</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {i18n.language === 'ru' ? 'средний балл' : i18n.language === 'kk' ? 'орташа балл' : 'average score'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Testimonials — V4 style single-visible carousel */}
          <Section
            id="v3-testimonials"
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
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="p-8 lg:p-12">
                    <blockquote className="text-xl font-medium leading-relaxed text-zinc-900 dark:text-white lg:text-2xl">
                      "{testimonials[activeSlide].quote}"
                    </blockquote>

                    <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-lg font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {testimonials[activeSlide].initials}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            {testimonials[activeSlide].name}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {testimonials[activeSlide].city} · {testimonials[activeSlide].school}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-3xl font-bold text-emerald-600">{testimonials[activeSlide].score}</p>
                          <p className="text-sm text-zinc-500">{testimonials[activeSlide].subject}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 px-4 py-2 dark:bg-emerald-900/20">
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            {testimonials[activeSlide].result}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation dots */}
                <div className="mt-6 flex items-center justify-center gap-3">
                  {testimonials.map((_, i) => (
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
              </div>
            </div>
          </Section>

          {/* Sessions/Proof Section */}
          <Section
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
                    {i18n.language === 'ru' ? 'Real exam conditions, real progress tracking, real results.' : i18n.language === 'kk' ? 'Нақты емтихан жағдайлары, нақты прогресс бақылау, нақты нәтижелер.' : 'Real exam conditions, real progress tracking, real results.'}
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
          </Section>

          {/* Pricing Section */}
          <Section id="v3-pricing" className="px-5 py-20 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-7xl">
              <div className="mb-12 text-center lg:mb-16">
                <span className="text-sm font-medium uppercase tracking-widest text-violet-600 dark:text-violet-400">
                  {i18n.language === 'ru' ? 'Тарифы' : i18n.language === 'kk' ? 'Тарифтер' : 'Pricing'}
                </span>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                  {i18n.language === 'ru' ? 'Простые тарифы' : i18n.language === 'kk' ? 'Қарапайым тарифтер' : 'Simple pricing'}
                </h2>
                <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400">
                  {i18n.language === 'ru' ? 'Без скрытых платежей' : i18n.language === 'kk' ? 'Жасырын төлемдер жоқ' : 'No hidden fees'}
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
                {pricingTiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={`relative rounded-2xl border p-6 lg:p-8 ${
                      tier.highlighted
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                        : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                    }`}
                  >
                    {tier.highlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">
                        {i18n.language === 'ru' ? 'Популярный' : i18n.language === 'kk' ? 'Танымал' : 'Popular'}
                      </div>
                    )}

                    <h3 className="text-lg font-semibold">{tier.name}</h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{tier.description}</p>

                    <div className="mt-4">
                      <span className="text-4xl font-bold">{tier.price}</span>
                      {tier.period && (
                        <span className={`ml-2 text-sm ${tier.highlighted ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {tier.period}
                        </span>
                      )}
                    </div>

                    <ul className="mt-6 space-y-3">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          {feature.included ? (
                            <svg className={`h-5 w-5 flex-shrink-0 ${tier.highlighted ? 'text-emerald-400' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 flex-shrink-0 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          <span className={!feature.included ? 'text-zinc-400 dark:text-zinc-600' : ''}>{feature.text}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      to="/login"
                      className={`mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                        tier.highlighted
                          ? 'bg-white text-zinc-900 hover:bg-zinc-100'
                          : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100'
                      }`}
                    >
                      {tier.cta}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* How It Works — Pipeline */}
          <Section className="relative px-5 py-24 lg:px-8 lg:py-32" id="v3-pipeline">
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
                  <li key={s.title} className="relative">
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
          </Section>

          {/* Instruction / How-to-use detailed section */}
          <Section
            id="v3-instructions"
            className="relative border-y border-zinc-200/90 bg-white/50 py-20 dark:border-zinc-800/80 dark:bg-zinc-900/20 lg:py-28"
          >
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="mb-12 text-center">
                <span className="text-sm font-medium uppercase tracking-widest text-violet-600 dark:text-violet-400">
                  {i18n.language === 'ru' ? 'Как пользоваться' : i18n.language === 'kk' ? 'Қалай қолдануға болады' : 'How to use'}
                </span>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                  {i18n.language === 'ru' ? '4 простых шага к результату' : i18n.language === 'kk' ? 'Нәтижеге 4 қарапайым қадам' : '4 simple steps to results'}
                </h2>
              </div>

              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                {/* Step 1 */}
                <div className="relative rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-widest text-violet-500">
                    {i18n.language === 'ru' ? 'Шаг 1' : i18n.language === 'kk' ? '1-қадам' : 'Step 1'}
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {i18n.language === 'ru' ? 'Регистрация' : i18n.language === 'kk' ? 'Тіркелу' : 'Sign up'}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {i18n.language === 'ru' ? 'Войдите через Telegram за 1 минуту — без паролей и подтверждений.' : i18n.language === 'kk' ? 'Telegram арқылы 1 минутта кіріңіз — парольсіз және растаусыз.' : 'Sign in via Telegram in 1 minute — no passwords or confirmations.'}
                  </p>
                </div>

                {/* Step 2 */}
                <div className="relative rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-widest text-fuchsia-500">
                    {i18n.language === 'ru' ? 'Шаг 2' : i18n.language === 'kk' ? '2-қадам' : 'Step 2'}
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {i18n.language === 'ru' ? 'Пробный тест' : i18n.language === 'kk' ? 'Сынақ тест' : 'Practice test'}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {i18n.language === 'ru' ? 'Пройдите 2 бесплатных теста, чтобы система поняла ваш текущий уровень.' : i18n.language === 'kk' ? 'Жүйе сіздің ағымдағы деңгейіңізді түсінетіндей 2 тегін тест өткізіңіз.' : 'Take 2 free tests so the system understands your current level.'}
                  </p>
                </div>

                {/* Step 3 */}
                <div className="relative rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-widest text-emerald-500">
                    {i18n.language === 'ru' ? 'Шаг 3' : i18n.language === 'kk' ? '3-қадам' : 'Step 3'}
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {i18n.language === 'ru' ? 'Анализ ошибок' : i18n.language === 'kk' ? 'Қателерді талдау' : 'Error analysis'}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {i18n.language === 'ru' ? 'Платформа покажет слабые места и предложит темы для повторения.' : i18n.language === 'kk' ? 'Платформа әлсіз жерлерді көрсетеді және қайталу тақырыптарын ұсынады.' : 'The platform will show weak spots and suggest topics to review.'}
                  </p>
                </div>

                {/* Step 4 */}
                <div className="relative rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-widest text-amber-500">
                    {i18n.language === 'ru' ? 'Шаг 4' : i18n.language === 'kk' ? '4-қадам' : 'Step 4'}
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {i18n.language === 'ru' ? 'Практика и результат' : i18n.language === 'kk' ? 'Практика мен нәтиже' : 'Practice and result'}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {i18n.language === 'ru' ? 'Работайте над ошибками, проходите тесты — и набирайте 120+ на реальном ЕНТ.' : i18n.language === 'kk' ? 'Қателермен жұмыс істеңіз, тесттерді өткізіңіз — және нақты ЕНТ-те 120+ жинаңыз.' : 'Work on mistakes, take tests — and score 120+ on the real ENT.'}
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* Passing Scores (Проходные баллы) Section */}
          <Section
            id="v3-scores"
            className="relative px-5 py-20 lg:px-8 lg:py-28"
          >
            <div className="mx-auto max-w-7xl">
              <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                {/* Left — info */}
                <div>
                  <span className="text-sm font-medium uppercase tracking-widest text-violet-600 dark:text-violet-400">
                    {i18n.language === 'ru' ? 'Проходные баллы' : i18n.language === 'kk' ? 'Проходной балл' : 'Passing scores'}
                  </span>
                  <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                    {i18n.language === 'ru' ? 'Узнайте, хватит ли ваших баллов для поступления' : i18n.language === 'kk' ? 'Баллдарыңыздың түсуге жеткіліктілігін біліңіз' : 'Find out if your score is enough to get in'}
                  </h2>
                  <p className="mt-5 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {i18n.language === 'ru'
                      ? 'Каждый университет и специальность устанавливают минимальный порог баллов. Сравните свои результаты с проходными баллами ведущих вузов Казахстана.'
                      : i18n.language === 'kk'
                      ? 'Әрбір университет пен мамандық минималды балл шегін белгілейді. Өз нәтижелеріңізді Қазақстанның жетекші жоғары оқу орындарының проходной баллдарымен салыстырыңыз.'
                      : 'Each university and major sets a minimum score threshold. Compare your results with passing scores of leading universities in Kazakhstan.'}
                  </p>

                  {/* Score comparison visual */}
                  <div className="mt-8 space-y-4">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {i18n.language === 'ru' ? 'Ваш результат' : i18n.language === 'kk' ? 'Сіздің нәтижеңіз' : 'Your result'}
                        </span>
                        <span className="font-mono font-semibold text-emerald-600">128/140</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-full w-[91%] rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {i18n.language === 'ru' ? 'Проходной балл (КБТУ, грант)' : i18n.language === 'kk' ? 'Проходной балл (КБТУ, грант)' : 'Passing score (KBTU, grant)'}
                        </span>
                        <span className="font-mono font-semibold text-violet-600">115/140</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-violet-400 to-violet-600" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {i18n.language === 'ru' ? 'Проходной балл (МГУ, бюджет)' : i18n.language === 'kk' ? 'Проходной балл (МГУ, бюджет)' : 'Passing score (MSU, budget)'}
                        </span>
                        <span className="font-mono font-semibold text-fuchsia-600">122/140</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-fuchsia-400 to-fuchsia-600" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to="/login"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 text-sm font-semibold text-white transition-all hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                    >
                      {i18n.language === 'ru' ? 'Узнать свои шансы' : i18n.language === 'kk' ? 'Мүмкіндіктерімді білу' : 'Check my chances'}
                    </Link>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-800 transition-all hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                </div>

                {/* Right — table of passing scores */}
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">
                  {/* Header */}
                  <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {i18n.language === 'ru' ? 'Проходные баллы 2025' : i18n.language === 'kk' ? '2025 проходной баллдары' : 'Passing scores 2025'}
                    </h3>
                  </div>

                  {/* Table */}
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {[
                      { uni: 'КБТУ (Алматы)', spec: 'IT-инженерия', grant: '115', budget: '—' },
                      { uni: 'МГУ (Москва)', spec: 'Математика', grant: '122', budget: '118' },
                      { uni: 'КазНУ (Алматы)', spec: 'Физика', grant: '118', budget: '110' },
                      { uni: 'НИШ ФМН (Астана)', spec: 'Химия', grant: '120', budget: '115' },
                      { uni: 'AITU (Астана)', spec: 'Энергетика', grant: '105', budget: '—' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between px-6 py-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.uni}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.spec}</p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="font-mono text-sm font-semibold text-emerald-600">{row.grant}</p>
                            <p className="text-xs text-zinc-400">{i18n.language === 'ru' ? 'грант' : i18n.language === 'kk' ? 'грант' : 'grant'}</p>
                          </div>
                          <div className="text-center">
                            <p className="font-mono text-sm font-semibold text-violet-600">{row.budget}</p>
                            <p className="text-xs text-zinc-400">{i18n.language === 'ru' ? 'бюджет' : i18n.language === 'kk' ? 'бюджет' : 'budget'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-zinc-100 bg-zinc-50/50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-xs text-zinc-400">
                      {i18n.language === 'ru' ? '* Баллы могут изменяться. Войдите, чтобы увидеть актуальные.' : i18n.language === 'kk' ? '* Баллдар өзгеруі мүмкін. Актуалды көру үшін кіріңіз.' : '* Scores may change. Sign in to see current.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Bento/Features Section */}
          <Section
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
          </Section>

          {/* Admit/CTA Section */}
          <Section className="relative px-5 py-24 lg:px-8 lg:py-32" id="v3-admit">
            <div className="mx-auto max-w-7xl">
              <div className="overflow-hidden rounded-3xl border border-dashed border-violet-400/40 bg-gradient-to-br from-violet-50/80 via-white to-fuchsia-50/40 p-10 dark:border-violet-600/30 dark:from-violet-950/30 dark:via-zinc-950 dark:to-fuchsia-950/20 sm:p-16">
                <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
                  <div className="relative">
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
          </Section>

          {/* FAQ Section */}
          <Section
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
          </Section>

          {/* Closing CTA */}
          <Section className="relative px-5 py-24 lg:px-8 lg:py-32" id="v3-close">
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
          </Section>
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
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .160 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {t('landingV3.footerWa')}
            </a>
          </div>
        </footer>

      </div>
    </div>
  );
}
