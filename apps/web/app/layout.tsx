import type { Metadata, Viewport } from "next"
import { Manrope, Instrument_Serif } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers"
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
  style: ["italic"],
  variable: "--font-instrument-serif",
  display: "swap",
})

// Telegram's SDK is only needed inside the Mini App; regular browser visits skip the extra request.
// The sessionStorage keys are the ones telegram-web-app.js itself persists across reloads.
const telegramLoader = `(function(){try{var c=location.search+"&"+location.hash;if(/tgWebApp(Data|Version|Platform)=/i.test(c)||/telegram/i.test(navigator.userAgent)||sessionStorage.getItem("__telegram__initParams")){var s=document.createElement("script");s.src="https://telegram.org/js/telegram-web-app.js";document.head.appendChild(s)}}catch(e){}})();`

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-test.kz"

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "mytest",
  url: siteUrl,
  description: "Пробные ЕНТ онлайн с разбором ошибок",
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
      { "@type": "Offer", name: "Разовый", price: "490", priceCurrency: "KZT" },
      { "@type": "Offer", name: "3 пробных", price: "900", priceCurrency: "KZT" },
      { "@type": "Offer", name: "5 пробных", price: "1490", priceCurrency: "KZT" },
      { "@type": "Offer", name: "Месяц без лимита", price: "2990", priceCurrency: "KZT" },
    ],
  },
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
    "Пройди 1 бесплатный пробный ЕНТ прямо сейчас — без карты. 140 вопросов, реальный формат, разбор ошибок, объяснения к каждому вопросу. Подготовка к ЕНТ 2027 онлайн на my-test.kz.",
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
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
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
        url: "/og-image.png",
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
    images: ["/og-image.png"],
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
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
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
    <html
      lang="ru"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${manrope.variable} ${instrumentSerif.variable} bg-background`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: telegramLoader }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
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
