import { Helmet } from 'react-helmet-async';
import { absoluteUrl, getOgImageUrl } from '../../lib/siteUrl';

export type AdvancedSEOProps = {
  title: string;
  description: string;
  /** Comma-separated keywords for meta keywords (still used by some regional crawlers) */
  keywords?: string;
  /** Path only, e.g. "/" or "/login" */
  canonicalPath: string;
  ogType?: 'website' | 'article';
  /** When true: noindex,nofollow + omit from social preview emphasis */
  noindex?: boolean;
  /** Override default OG/Twitter image (absolute URL) */
  ogImage?: string;
  ogImageAlt?: string;
  /** html lang BCP 47 */
  htmlLang?: string;
  /** JSON-LD object (single script tag) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Additional hreflang same-URL alternates (SPA: language in client) */
  includeHreflang?: boolean;
};

function toJsonLdScript(data: Record<string, unknown> | Record<string, unknown>[]): string {
  if (Array.isArray(data)) {
    return JSON.stringify(data.length === 1 ? data[0] : { '@context': 'https://schema.org', '@graph': data });
  }
  return JSON.stringify(data);
}

export function AdvancedSEO({
  title,
  description,
  keywords,
  canonicalPath,
  ogType = 'website',
  noindex = false,
  ogImage,
  ogImageAlt = 'MyTest',
  htmlLang = 'ru',
  jsonLd,
  includeHreflang = true,
}: AdvancedSEOProps) {
  const canonical = absoluteUrl(canonicalPath === '/' ? '/' : canonicalPath);
  const image = ogImage || getOgImageUrl();
  const robots = noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  return (
    <Helmet prioritizeSeoTags>
      <html lang={htmlLang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <meta name="bingbot" content={robots} />
      <link rel="canonical" href={canonical} />

      {includeHreflang ? (
        <>
          <link rel="alternate" hrefLang="ru" href={canonical} />
          <link rel="alternate" hrefLang="kk" href={canonical} />
          <link rel="alternate" hrefLang="en" href={canonical} />
          <link rel="alternate" hrefLang="x-default" href={canonical} />
        </>
      ) : null}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="MyTest" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={ogImageAlt} />
      <meta property="og:locale" content="ru_RU" />
      <meta property="og:locale:alternate" content="kk_KZ" />
      <meta property="og:locale:alternate" content="en_US" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={ogImageAlt} />

      {/* Discovery */}
      <meta name="author" content="MyTest" />
      <meta name="application-name" content="MyTest" />
      <meta name="theme-color" content="#05070d" />
      <meta name="referrer" content="strict-origin-when-cross-origin" />
      <meta name="format-detection" content="telephone=no" />

      {/* Geo / regional (Kazakhstan) */}
      <meta name="geo.region" content="KZ" />
      <meta name="geo.placename" content="Kazakhstan" />

      {jsonLd ? (
        <script type="application/ld+json">{toJsonLdScript(jsonLd)}</script>
      ) : null}
    </Helmet>
  );
}
