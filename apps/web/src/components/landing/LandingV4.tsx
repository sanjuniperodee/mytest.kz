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

export type LandingV4Props = {
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

// Logo Component
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 dark:bg-white">
        <svg className="h-5 w-5 text-white dark:text-zinc-900" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white">MyTest</span>
    </div>
  );
}

// Navigation Link
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
    >
      {children}
    </a>
  );
}

// Primary Button
function PrimaryButton({ to, children, className = '' }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.98] dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 ${className}`}
    >
      {children}
    </Link>
  );
}

// Secondary Button
function SecondaryButton({ href, children, className = '' }: { href?: string; children: React.ReactNode; className?: string }) {
  const content = (
    <span className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white/80 px-5 text-sm font-medium text-zinc-800 backdrop-blur-sm transition-all hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:border-zinc-600 ${className}`}>
      {children}
    </span>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return content;
}

// Section Wrapper with fade-in animation
function Section({ children, className = '', id = '' }: { children: React.ReactNode; className?: string; id?: string }) {
  const { ref, isInView } = useInView();
  
  return (
    <section
      id={id}
      ref={ref}
      className={`transition-all duration-700 ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </section>
  );
}

export function LandingV4({ whatsappHref }: LandingV4Props) {
  const { t, i18n } = useTranslation();
  const [isDark, setIsDark] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [isTestimonialPaused, setIsTestimonialPaused] = useState(false);

  // Testimonials data
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

  // Data from translations
  const proof = useMemo(() => t('landingV4.proofItems', { returnObjects: true }) as Proof[], [t]);
  const steps = useMemo(() => t('landingV4.pipelineSteps', { returnObjects: true }) as Step[], [t]);
  const bento = useMemo(() => t('landingV4.bentoItems', { returnObjects: true }) as Bento[], [t]);
  const faq = useMemo(() => t('landingV4.faqItems', { returnObjects: true }) as Faq[], [t]);

  // Theme handling
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    read();
    const m = new MutationObserver(read);
    m.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', read);
    return () => { m.disconnect(); window.removeEventListener('storage', read); };
  }, []);

  // Testimonials auto-play
  useEffect(() => {
    if (isTestimonialPaused) return;
    const timer = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isTestimonialPaused, testimonials.length]);

  return (
    <div className="antialiased text-zinc-900 dark:text-zinc-100">
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        
        {/* Header - Clean and minimal */}
        <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
            <Logo />
            
            <nav className="hidden items-center gap-6 lg:flex">
              <NavLink href="#features">{i18n.language === 'ru' ? 'Возможности' : i18n.language === 'kk' ? 'Мүмкіндіктер' : 'Features'}</NavLink>
              <NavLink href="#how-it-works">{i18n.language === 'ru' ? 'Как работает' : i18n.language === 'kk' ? 'Қалай жұмыс істейді' : 'How it works'}</NavLink>
              <NavLink href="#pricing">{i18n.language === 'ru' ? 'Тарифы' : i18n.language === 'kk' ? 'Тарифтер' : 'Pricing'}</NavLink>
              <NavLink href="#faq">FAQ</NavLink>
            </nav>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cycleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
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
              
              <PrimaryButton to="/login">
                {i18n.language === 'ru' ? 'Начать' : i18n.language === 'kk' ? 'Бастау' : 'Get started'}
              </PrimaryButton>
            </div>
          </div>
        </header>

        <main>
          
          {/* Hero Section - Clean, professional */}
          <Section className="relative px-5 py-20 lg:px-8 lg:py-28" id="hero">
            <div className="mx-auto max-w-6xl">
              <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
                
                {/* Left - Content */}
                <div>
                  {/* Kicker */}
                  <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {i18n.language === 'ru' ? 'Вход через Telegram' : i18n.language === 'kk' ? 'Telegram арқылы кіру' : 'Sign in via Telegram'}
                  </div>
                  
                  {/* Headline */}
                  <h1 className="mt-5 text-4xl font-bold tracking-tight text-zinc-900 dark:text-white lg:text-5xl">
                    {i18n.language === 'ru' ? 'Практикуйтесь как на реальном экзамене' : i18n.language === 'kk' ? 'Нақты емтихандағыдай практика жасаңыз' : 'Practice like the real exam'}
                  </h1>
                  
                  {/* Subheadline */}
                  <p className="mt-5 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {i18n.language === 'ru' 
                      ? 'Тренировочные тесты ЕНТ с таймером, навигацией и детальным разбором ошибок. Подготовка, которая приближает к результату.'
                      : i18n.language === 'kk'
                      ? 'Таймер, навигация және қателерді толық талдау бар ЕНТ жаттығу тесттері. Нәтижеге жақындатыратын дайындық.'
                      : 'ENT practice tests with timer, navigation, and detailed error analysis. Prep that gets you closer to results.'}
                  </p>
                  
                  {/* CTAs */}
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <PrimaryButton to="/login">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.58.295-.002.003 0 0 0 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                      </svg>
                      {i18n.language === 'ru' ? 'Войти через Telegram' : i18n.language === 'kk' ? 'Telegram арқылы кіру' : 'Sign in via Telegram'}
                    </PrimaryButton>
                    <SecondaryButton href={whatsappHref}>
                      <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </SecondaryButton>
                  </div>
                  
                  {/* Trust line */}
                  <p className="mt-5 text-sm text-zinc-500">
                    {i18n.language === 'ru' ? '2 бесплатных теста сразу после входа' : i18n.language === 'kk' ? 'Кіруден кейін бірден 2 тегін тест' : '2 free tests right after sign in'}
                  </p>
                </div>
                
                {/* Right - Mockup Card */}
                <div className="relative">
                  {/* Main mockup */}
                  <div className="rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-red-400" />
                        <div className="h-3 w-3 rounded-full bg-amber-400" />
                        <div className="h-3 w-3 rounded-full bg-emerald-400" />
                      </div>
                      <span className="text-sm font-medium text-zinc-500">MyTest — UNT Пробник</span>
                    </div>
                    
                    {/* Content */}
                    <div className="p-6">
                      {/* Progress bar */}
                      <div className="mb-6">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Прогресс</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">45/120</span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-full w-[37%] rounded-full bg-zinc-900 dark:bg-white" />
                        </div>
                      </div>
                      
                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                          <p className="text-xs text-zinc-500">Осталось</p>
                          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">1:15</p>
                        </div>
                        <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                          <p className="text-xs text-zinc-500">Баллы</p>
                          <p className="mt-1 text-2xl font-semibold text-emerald-600">38</p>
                        </div>
                        <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                          <p className="text-xs text-zinc-500">Точность</p>
                          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">84%</p>
                        </div>
                      </div>
                      
                      {/* Subjects mini */}
                      <div className="mt-5 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-600 dark:text-zinc-400">Математическая грамотность</span>
                          <span className="font-medium text-emerald-600">9/10</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-600 dark:text-zinc-400">Чтение</span>
                          <span className="font-medium text-emerald-600">8/10</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-600 dark:text-zinc-400">История Казахстана</span>
                          <span className="font-medium text-amber-600">18/20</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Floating mini card */}
                  <div className="absolute -bottom-4 -right-4 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 lg:bottom-6 lg:-right-6">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">
                          {i18n.language === 'ru' ? 'Лучший результат' : i18n.language === 'kk' ? 'Ең жақсы нәтиже' : 'Best score'}
                        </p>
                        <p className="text-xs text-zinc-500">128/140</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Stats Bar - Trust signals */}
          <Section className="border-y border-zinc-100 bg-zinc-50/50 py-10 dark:border-zinc-800 dark:bg-zinc-900/30" id="stats">
            <div className="mx-auto max-w-6xl px-5 lg:px-8">
              <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                    <AnimatedCounter target={12847} suffix="+" />
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {i18n.language === 'ru' ? 'учеников сдали ЕНТ' : i18n.language === 'kk' ? 'оқушы емтихан тапсырды' : 'students took ENT'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                    <AnimatedCounter target={94} suffix="%" />
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {i18n.language === 'ru' ? 'набрали грант' : i18n.language === 'kk' ? 'грант алды' : 'got grants'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                    <AnimatedCounter target={240000} suffix="+" />
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {i18n.language === 'ru' ? 'тестов пройдено' : i18n.language === 'kk' ? 'тест өткізілді' : 'tests completed'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                    4.9
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {i18n.language === 'ru' ? 'средний балл' : i18n.language === 'kk' ? 'орташа балл' : 'average score'}
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* Features Section */}
          <Section className="px-5 py-20 lg:px-8 lg:py-28" id="features">
            <div className="mx-auto max-w-6xl">
              {/* Section header - asymmetric */}
              <div className="mb-12 lg:mb-16">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white lg:text-4xl">
                  {i18n.language === 'ru' ? 'Всё для подготовки к ЕНТ' : i18n.language === 'kk' ? 'ЕНТ дайындығының бәрі' : 'Everything for ENT prep'}
                </h2>
                <p className="mt-3 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
                  {i18n.language === 'ru' 
                    ? 'Не просто вопросы — система, которая помогает найти слабые места и работать над ними.'
                    : i18n.language === 'kk'
                    ? 'Сұрақтар ғана емес — әлсіз жерлерді табуға және олармен жұмыс істеуге көмектесетін жүйе.'
                    : 'Not just questions — a system that helps find weak spots and work on them.'}
                </p>
              </div>
              
              {/* Bento grid - intentionally asymmetric */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bento.map((item, i) => (
                  <div
                    key={item.title}
                    className={`group rounded-2xl border border-zinc-100 bg-white p-6 transition-all hover:border-zinc-200 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${
                      i === 0 ? 'md:col-span-2' : ''
                    } ${i === 3 ? 'lg:col-span-2' : ''} ${i === 4 ? 'lg:row-span-2' : ''}`}
                  >
                    {/* Icon */}
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      i % 3 === 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                      i % 3 === 1 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {i === 0 && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      )}
                      {i === 1 && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {i === 2 && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {i === 3 && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                      {i === 4 && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      )}
                      {i === 5 && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                      )}
                    </div>
                    
                    <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* How It Works */}
          <Section className="border-y border-zinc-100 bg-zinc-50/50 px-5 py-20 dark:border-zinc-800 dark:bg-zinc-900/30 lg:px-8 lg:py-28" id="how-it-works">
            <div className="mx-auto max-w-6xl">
              <div className="mb-12 lg:mb-16">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white lg:text-4xl">
                  {i18n.language === 'ru' ? 'Как начать' : i18n.language === 'kk' ? 'Қалай бастауға болады' : 'How to start'}
                </h2>
              </div>
              
              {/* Steps */}
              <div className="relative">
                {/* Vertical line (desktop) */}
                <div className="absolute left-[21px] top-0 h-full w-px bg-zinc-200 dark:bg-zinc-800 lg:left-1/2 lg:-ml-px" />
                
                <div className="space-y-8 lg:space-y-0">
                  {steps.map((step, i) => (
                    <div
                      key={step.title}
                      className={`relative flex gap-6 lg:grid lg:grid-cols-2 lg:gap-12 ${
                        i % 2 === 1 ? 'lg:flex-row-reverse' : ''
                      }`}
                    >
                      {/* Content */}
                      <div className={`flex-1 ${i % 2 === 1 ? 'lg:text-right' : ''}`}>
                        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 lg:h-12 lg:w-12 ${
                          i % 2 === 1 ? 'lg:order-2' : ''
                        }`}>
                          <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">{i + 1}</span>
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-white">
                          {step.title}
                        </h3>
                        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                          {step.body}
                        </p>
                      </div>
                      
                      {/* Spacer for alternating layout */}
                      <div className="hidden lg:block lg:flex-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Testimonials */}
          <Section className="px-5 py-20 lg:px-8 lg:py-28" id="testimonials"
            onMouseEnter={() => setIsTestimonialPaused(true)}
            onMouseLeave={() => setIsTestimonialPaused(false)}
          >
            <div className="mx-auto max-w-6xl">
              <div className="mb-12 lg:mb-16">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white lg:text-4xl">
                  {i18n.language === 'ru' ? 'Истории учеников' : i18n.language === 'kk' ? 'Оқушылардың хикаялары' : 'Student stories'}
                </h2>
                <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
                  {i18n.language === 'ru' ? 'Реальные результаты реальных людей' : i18n.language === 'kk' ? 'Нақты адамдардың нақты нәтижелері' : 'Real results from real people'}
                </p>
              </div>
              
              {/* Main testimonial */}
              <div className="relative">
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="p-8 lg:p-12">
                    <blockquote className="text-xl font-medium leading-relaxed text-zinc-900 dark:text-white lg:text-2xl">
                      "{testimonials[activeTestimonial].quote}"
                    </blockquote>
                    
                    <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-lg font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {testimonials[activeTestimonial].initials}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            {testimonials[activeTestimonial].name}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {testimonials[activeTestimonial].city} · {testimonials[activeTestimonial].school}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-3xl font-bold text-emerald-600">{testimonials[activeTestimonial].score}</p>
                          <p className="text-sm text-zinc-500">{testimonials[activeTestimonial].subject}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 px-4 py-2 dark:bg-emerald-900/20">
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            {testimonials[activeTestimonial].result}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Navigation dots */}
                <div className="mt-6 flex items-center justify-center gap-2">
                  {testimonials.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveTestimonial(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === activeTestimonial
                          ? 'w-6 bg-zinc-900 dark:bg-white'
                          : 'w-2 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600'
                      }`}
                      aria-label={`Go to testimonial ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Pricing */}
          <Section className="border-y border-zinc-100 bg-zinc-50/50 px-5 py-20 dark:border-zinc-800 dark:bg-zinc-900/30 lg:px-8 lg:py-28" id="pricing">
            <div className="mx-auto max-w-6xl">
              <div className="mb-12 text-center lg:mb-16">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white lg:text-4xl">
                  {i18n.language === 'ru' ? 'Простые тарифы' : i18n.language === 'kk' ? 'Қарапайым тарифтер' : 'Simple pricing'}
                </h2>
                <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
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
                    
                    <PrimaryButton
                      to="/login"
                      className={`mt-8 w-full ${tier.highlighted ? 'bg-white text-zinc-900 hover:bg-zinc-100' : ''}`}
                    >
                      {tier.cta}
                    </PrimaryButton>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* FAQ */}
          <Section className="px-5 py-20 lg:px-8 lg:py-28" id="faq">
            <div className="mx-auto max-w-3xl">
              <div className="mb-12 lg:mb-16">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white lg:text-4xl">
                  FAQ
                </h2>
              </div>
              
              <div className="space-y-3">
                {faq.map((f, i) => (
                  <div
                    key={f.question}
                    className={`overflow-hidden rounded-xl border transition-colors ${
                      openFaq === i
                        ? 'border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left"
                    >
                      <span className="font-medium text-zinc-900 dark:text-white">{f.question}</span>
                      <span className={`shrink-0 text-zinc-400 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>
                    <div className={`overflow-hidden transition-all duration-200 ${openFaq === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <p className="px-5 pb-5 text-zinc-600 dark:text-zinc-400">{f.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Final CTA */}
          <Section className="px-5 py-20 lg:px-8 lg:py-28" id="cta">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white lg:text-4xl">
                {i18n.language === 'ru' ? 'Готовы начать?' : i18n.language === 'kk' ? 'Бастауға дайынсыз ба?' : 'Ready to start?'}
              </h2>
              <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
                {i18n.language === 'ru' 
                  ? 'Начните с 2 бесплатных тестов. Вход через Telegram — за минуту.'
                  : i18n.language === 'kk'
                  ? '2 тегін тесттен бастаңыз. Telegram арқылы кіру — бір минутта.'
                  : 'Start with 2 free tests. Sign in via Telegram — in a minute.'}
              </p>
              
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <PrimaryButton to="/login">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.58.295-.002.003 0 0 0 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                  </svg>
                  {i18n.language === 'ru' ? 'Войти через Telegram' : i18n.language === 'kk' ? 'Telegram арқылы кіру' : 'Sign in via Telegram'}
                </PrimaryButton>
                <SecondaryButton href={whatsappHref}>
                  <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </SecondaryButton>
              </div>
            </div>
          </Section>
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-100 py-10 dark:border-zinc-800">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 lg:px-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Logo />
              <p className="text-sm text-zinc-500">
                © 2026 MyTest. {i18n.language === 'ru' ? 'Все права защищены.' : i18n.language === 'kk' ? 'Барлық құқықтар қорғалған.' : 'All rights reserved.'}
              </p>
            </div>
            
            <a
              href={whatsappHref}
              className="flex items-center gap-2 text-sm text-zinc-600 transition-colors hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {i18n.language === 'ru' ? 'Связаться' : i18n.language === 'kk' ? 'Байланысу' : 'Contact'}
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
