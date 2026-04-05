import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

/** Emit robots.txt + sitemap.xml into dist with absolute URLs from VITE_SITE_URL */
function seoEmitPlugin(siteUrl: string): Plugin {
  const base = siteUrl.replace(/\/$/, '');
  const today = new Date().toISOString().split('T')[0];

  return {
    name: 'bilimland-seo-emit',
    apply: 'build',
    writeBundle(opts) {
      const outDir = opts.dir;
      if (!outDir) return;

      const robots = `# BilimLand — advanced crawl hints
User-agent: *
Allow: /
Disallow: /app
Disallow: /profile
Disallow: /settings
Disallow: /mistakes
Disallow: /exam/
Disallow: /test/
Disallow: /channel-gate

# AI / research crawlers (optional — remove lines to disallow)
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: ${base}/sitemap.xml
`;

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${base}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="ru-KZ" href="${base}/"/>
    <xhtml:link rel="alternate" hreflang="kk-KZ" href="${base}/"/>
    <xhtml:link rel="alternate" hreflang="en" href="${base}/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${base}/"/>
  </url>
</urlset>`;

      writeFileSync(resolve(outDir, 'robots.txt'), robots);
      writeFileSync(resolve(outDir, 'sitemap.xml'), sitemap);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), '');
  const siteUrl = (env.VITE_SITE_URL || 'https://my-test.kz').replace(/\/$/, '');

  return {
    plugins: [react(), seoEmitPlugin(siteUrl)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
