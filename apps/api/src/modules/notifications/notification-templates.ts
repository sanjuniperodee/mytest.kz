import type { NotificationCampaignDefinition } from './notification-campaigns';

export type NotificationLanguage = 'ru' | 'kk';

/** Per-delivery data for campaigns whose text depends on the user's activity. */
export type NotificationContext =
  | {
      kind: 'result_recap';
      sessionId: string;
      rawScore: number | null;
      maxScore: number | null;
      /** Up to three subjects with the most lost points. */
      weakSubjects: Array<{ name: string; lost: number }>;
      showPremium: boolean;
    }
  | { kind: 'community_reply'; postId: string; replies: number; excerpt: string }
  | { kind: 'session'; sessionId: string };

export interface RenderedNotification {
  /** Push title, email subject and heading. */
  title: string;
  /** Plain text: push body, Telegram text for dynamic campaigns. */
  body: string;
  /** Email body: paragraphs, then the bullet list, then closing paragraphs (plain text, escaped when rendered). */
  paragraphs: string[];
  bullets: string[];
  closing: string[];
  ctaLabel: string;
  /** Absolute URL the notification opens. */
  url: string;
  /** Push collapse tag. */
  tag: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const DEFAULT_SITE_URL = 'https://my-test.kz';

export function notificationLanguage(preferred: string | null | undefined): NotificationLanguage {
  return preferred === 'kk' ? 'kk' : 'ru';
}

export function absoluteUrl(siteUrl: string, path: string) {
  const base = (siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function pluralRu(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function excerpt(text: string, max = 80) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

function formatPoints(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

export function renderNotification(
  definition: NotificationCampaignDefinition,
  lang: NotificationLanguage,
  context: NotificationContext | null | undefined,
  siteUrl: string,
): RenderedNotification {
  const kk = lang === 'kk';
  const base: RenderedNotification = {
    title: definition.headline[lang],
    body: definition.message[lang],
    paragraphs: [definition.message[lang]],
    bullets: [],
    closing: [],
    ctaLabel: definition.cta[lang],
    url: absoluteUrl(siteUrl, definition.path),
    tag: definition.key,
  };

  if (context?.kind === 'session') {
    return { ...base, url: absoluteUrl(siteUrl, `/exam/${context.sessionId}`), tag: `${definition.key}:${context.sessionId}` };
  }

  if (context?.kind === 'result_recap') {
    const hasScore = context.rawScore != null && context.maxScore != null && context.maxScore > 0;
    const title = hasScore
      ? kk
        ? `ҰБТ нәтижеңіз: ${formatPoints(context.rawScore!)} / ${formatPoints(context.maxScore!)}`
        : `Ваш результат ЕНТ: ${formatPoints(context.rawScore!)} из ${formatPoints(context.maxScore!)}`
      : definition.headline[lang];
    const bullets = context.weakSubjects
      .slice(0, 3)
      .map((subject) => `${subject.name} — −${formatPoints(subject.lost)}`);
    const paragraphs: string[] = [];
    if (bullets.length > 0) {
      paragraphs.push(kk ? 'Ең көп балл жоғалтқан пәндер:' : 'Больше всего баллов потеряно здесь:');
    } else {
      paragraphs.push(
        kk
          ? 'Керемет нәтиже — қате жоқтың қасы. Талдауды ашып, білімді бекітіңіз.'
          : 'Отличный результат — ошибок почти нет. Откройте разбор, чтобы закрепить.',
      );
    }
    const closing: string[] = [];
    if (bullets.length > 0) {
      closing.push(
        kk
          ? 'Талдауды ашып, осы пәндерден бастаңыз.'
          : 'Откройте разбор и начните с этих предметов.',
      );
    }
    if (context.showPremium) {
      closing.push(
        kk
          ? 'Қателер талдауы мен олармен жұмыс — Premium-да.'
          : 'Объяснения ошибок и работа над ними — в Premium.',
      );
    }
    const body = [paragraphs[0], ...bullets.map((line) => `• ${line}`), ...closing].join('\n');
    return {
      ...base,
      title,
      body,
      paragraphs,
      bullets,
      closing,
      url: absoluteUrl(siteUrl, `/exam/${context.sessionId}/review`),
      tag: `${definition.key}:${context.sessionId}`,
    };
  }

  if (context?.kind === 'community_reply') {
    const n = Math.max(1, context.replies);
    const quote = excerpt(context.excerpt);
    const body = kk
      ? `Жазбаңызға ${n} жаңа жауап келді${quote ? `: «${quote}»` : '.'}`
      : `${n} ${pluralRu(n, 'новый ответ', 'новых ответа', 'новых ответов')} на ваш пост${quote ? ` «${quote}»` : ''}.`;
    return {
      ...base,
      body,
      paragraphs: [body],
      url: absoluteUrl(siteUrl, `/dashboard/community/post/${context.postId}`),
      tag: `${definition.key}:${context.postId}`,
    };
  }

  return base;
}

/** Telegram keeps the campaign's own text; dynamic campaigns send headline + body. */
export function renderTelegramText(
  definition: NotificationCampaignDefinition,
  rendered: RenderedNotification,
  lang: NotificationLanguage,
  context: NotificationContext | null | undefined,
) {
  if (!context || context.kind === 'session') return definition.message[lang];
  return `${rendered.title}\n\n${rendered.body}`;
}

export function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = '#1c1917';
const TEXT = '#292524';
const MUTED = '#78716c';
const PAPER = '#f5f3ee';
const BORDER = '#e7e5e4';

export function renderEmail(
  rendered: RenderedNotification,
  lang: NotificationLanguage,
  unsubscribeUrl: string,
): RenderedEmail {
  const kk = lang === 'kk';
  const footerReason = kk
    ? 'Бұл хатты my-test.kz сайтына Google арқылы тіркелгеніңіз үшін алдыңыз.'
    : 'Вы получили это письмо, потому что зарегистрировались на my-test.kz через Google.';
  const unsubscribeLabel = kk ? 'Хаттардан бас тарту' : 'Отписаться от писем';

  const before = rendered.paragraphs;
  const after = rendered.closing;
  const paragraph = (text: string) =>
    `<p style="margin:0 0 12px;font:400 15px/1.6 ${FONT};color:${TEXT};">${escapeHtml(text)}</p>`;
  const list = rendered.bullets.length
    ? `<ul style="margin:0 0 12px;padding-left:20px;font:400 15px/1.6 ${FONT};color:${TEXT};">${rendered.bullets
        .map((line) => `<li style="margin:0 0 4px;">${escapeHtml(line)}</li>`)
        .join('')}</ul>`
    : '';

  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(rendered.title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(rendered.body.split('\n')[0] ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;">
<tr><td style="padding:24px 28px 0;font:700 17px/1 ${FONT};color:${INK};letter-spacing:-0.01em;">mytest</td></tr>
<tr><td style="padding:22px 28px 4px;"><h1 style="margin:0 0 14px;font:600 22px/1.3 ${FONT};color:${INK};">${escapeHtml(rendered.title)}</h1>
${before.map(paragraph).join('\n')}
${list}
${after.map(paragraph).join('\n')}
</td></tr>
<tr><td style="padding:10px 28px 30px;">
<a href="${escapeHtml(rendered.url)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font:600 15px/1 ${FONT};padding:15px 24px;border-radius:10px;">${escapeHtml(rendered.ctaLabel)}</a>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:16px 28px;font:400 12px/1.6 ${FONT};color:${MUTED};">
${escapeHtml(footerReason)}<br>
<a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(unsubscribeLabel)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const textLines = [
    rendered.title,
    '',
    ...before,
    ...rendered.bullets.map((line) => `• ${line}`),
    ...after,
    '',
    `${rendered.ctaLabel}: ${rendered.url}`,
    '',
    '—',
    'mytest · my-test.kz',
    footerReason,
    `${unsubscribeLabel}: ${unsubscribeUrl}`,
  ];

  return { subject: rendered.title, html, text: textLines.join('\n') };
}

export function renderUnsubscribePage(lang: NotificationLanguage, ok: boolean, siteUrl: string) {
  const kk = lang === 'kk';
  const title = ok
    ? kk
      ? 'Сіз хаттардан бас тарттыңыз'
      : 'Вы отписались от писем'
    : kk
      ? 'Сілтеме жарамсыз'
      : 'Ссылка недействительна';
  const text = ok
    ? kk
      ? 'mytest енді сізге хат жібермейді. Есептік жазбаңыз бен нәтижелеріңіз сақталады.'
      : 'mytest больше не будет присылать вам письма. Аккаунт и результаты сохранены.'
    : kk
      ? 'Хаттағы сілтемені толығымен ашып көріңіз немесе қолдау қызметіне жазыңыз.'
      : 'Откройте ссылку из письма целиком или напишите в поддержку.';
  const back = kk ? 'mytest-ке өту' : 'Перейти в mytest';
  return `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:${PAPER};font-family:${FONT};color:${TEXT};">
<main style="max-width:480px;margin:12vh auto 0;padding:32px 28px;background:#fff;border:1px solid ${BORDER};border-radius:14px;">
<p style="margin:0 0 20px;font-weight:700;color:${INK};">mytest</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${INK};">${escapeHtml(title)}</h1>
<p style="margin:0 0 24px;line-height:1.6;">${escapeHtml(text)}</p>
<a href="${escapeHtml(absoluteUrl(siteUrl, '/dashboard'))}" style="display:inline-block;background:${INK};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">${escapeHtml(back)}</a>
</main>
</body>
</html>`;
}
