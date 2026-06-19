import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Manrope, Instrument_Serif } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers"
import "katex/dist/katex.min.css"
import "./globals.css"

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  // @ts-ignore
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "mytest",
  url: siteUrl,
  description: "Пробные ЕНТ онлайн с разбором ошибок",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
}

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "mytest",
  alternateName: "my-test.kz",
  url: siteUrl,
  logo: `${siteUrl}/icon.svg`,
  description: "Онлайн-платформа для подготовки к ЕНТ (ҰБТ) в Казахстане. Пробные тесты в реальном формате, разбор ошибок, калькулятор шансов на грант.",
  foundingLocation: {
    "@type": "Place",
    addressLocality: "Алматы",
    addressCountry: "KZ",
  },
  sameAs: [
    "https://www.instagram.com/mytestkz",
    "https://www.tiktok.com/@mytestkz",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    availableLanguage: ["Kazakh", "Russian"],
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Тарифы подготовки к ЕНТ",
    itemListElement: [
      { "@type": "Offer", name: "Бесплатный пробный ЕНТ", price: "0", priceCurrency: "KZT" },
      { "@type": "Offer", name: "Стартер", price: "690", priceCurrency: "KZT" },
      { "@type": "Offer", name: "Базовый", price: "1490", priceCurrency: "KZT" },
      { "@type": "Offer", name: "Премиум", price: "3900", priceCurrency: "KZT" },
    ],
  },
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Задания совпадают с настоящим ЕНТ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Формат — 1:1 с экзаменом: 140 заданий, 240 минут, такая же структура и баллы. Сами задания мы пишем с действующими преподавателями по программе МОН РК, обновляем базу каждый месяц.",
      },
    },
    {
      "@type": "Question",
      name: "Можно ли проходить с телефона?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Да. Талапкер работает на любом устройстве: телефон, планшет, ноутбук. Прогресс синхронизируется автоматически — можно начать в автобусе и закончить дома.",
      },
    },
    {
      "@type": "Question",
      name: "Что если я уже зарегистрировался, но не понравилось?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "В течение 14 дней после оплаты — полный возврат денег без вопросов. Просто напиши в чат поддержки.",
      },
    },
    {
      "@type": "Question",
      name: "Подходит для подготовки на грант?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Да. Ты заранее видишь, какой балл стабильно показываешь, и можешь сравнить с пороговым для нужного вуза и специальности. Все профили ЕНТ (включая творческие комбинации) поддерживаются.",
      },
    },
    {
      "@type": "Question",
      name: "А если я учусь в казахской школе?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Все задания доступны на двух языках — қазақ тілі и русском. Переключение в один клик, прогресс общий.",
      },
    },
    {
      "@type": "Question",
      name: "Как часто обновляются задания?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Каждый месяц мы добавляем 200–400 новых заданий и убираем устаревшие. Ты не будешь видеть один и тот же тест дважды.",
      },
    },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "MyTest",
  manifest: "/manifest.json",
  title: {
    default: "mytest — бесплатный пробный ЕНТ онлайн с разбором ошибок",
    template: "%s | mytest",
  },
  description:
    "Пройди 1 бесплатный пробный ЕНТ прямо сейчас — без карты. 140 вопросов, реальный формат, разбор ошибок, объяснения к каждому вопросу. Подготовка к ЕНТ 2027 онлайн на mytest.kz.",
  keywords: [
    "ЕНТ",
    "пробный ЕНТ",
    "бесплатный пробный ЕНТ",
    "ЕНТ 2027",
    "ЕНТ 2026",
    "подготовка к ЕНТ",
    "подготовка к ЕНТ онлайн",
    "подготовка к ЕНТ бесплатно",
    "тесты ЕНТ онлайн",
    "пробный ЕНТ бесплатно",
    "ЕНТ тест онлайн",
    "пробник ЕНТ",
    "разбор ошибок ЕНТ",
    "поступление Казахстан грант",
    "ЕНТ математика",
    "ЕНТ история Казахстана",
    "mytest",
    "my-test.kz",
    "ҰБТ",
    "ҰБТ дайындық",
    "тегін ҰБТ",
  ],
  authors: [{ name: "mytest" }],
  creator: "mytest",
  publisher: "mytest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: siteUrl,
    siteName: "mytest",
    title: "mytest — бесплатный пробный ЕНТ онлайн с разбором ошибок",
    description:
      "1 бесплатный пробный ЕНТ без карты. 140 вопросов, реальный формат, разбор ошибок после сдачи. Подготовка к ЕНТ 2027 онлайн.",
    images: [
      {
        url: "/og-cover.svg",
        width: 1200,
        height: 630,
        alt: "mytest — подготовка к ЕНТ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "mytest — пробные ЕНТ онлайн с разбором ошибок",
    description:
      "Сдавай пробные ЕНТ в реальном формате. Мгновенный балл, Premium-разбор ошибок и объяснения к каждому вопросу.",
    site: "@mytestkz",
    creator: "@mytestkz",
    images: ["/og-cover.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      ru: siteUrl,
      kk: `${siteUrl}?lang=kk`,
    },
  },
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#0a0e18",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`${manrope.variable} ${instrumentSerif.variable} bg-background`}>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <Toaster richColors closeButton position="top-right" />
        {process.env.NODE_ENV === "production" &&
          process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "true" && <Analytics />}
      </body>
    </html>
  )
}
