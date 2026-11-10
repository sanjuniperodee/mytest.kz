import { ConfigService } from '@nestjs/config';
import { QotdChannelService, qotdPlainText, qotdSourceHtml } from '../src/modules/telegram/qotd-channel.service';
import type { TelegramBotService } from '../src/modules/telegram/telegram-bot.service';

const SITE = 'https://site.test';
const SOURCE_LINE = `Источник: <a href="${SITE}/istochniki#openstax">адаптировано по учебникам OpenStax, CC BY 4.0</a>`;

const qotd = (extra: Record<string, unknown> = {}) => ({
  key: 'qotd:2026-11-11',
  date: '2026-11-11',
  subject: { ru: 'Биология' },
  topic: { name: 'Генетика', href: '/ent/biologiya/genetika-i-selekciya' },
  stemHtml: 'Что изучает популяционная генетика?',
  optionsHtml: ['Частоты аллелей', 'Строение клетки', 'Обмен веществ', 'Экосистемы'],
  correct: 0,
  explanationHtml: 'Изменение частот аллелей в популяциях.',
  ...extra,
});

/** One tick of the channel job with the site's /api/qotd answer stubbed. */
async function runTick(payload: unknown) {
  const telegram = {
    notifyChannelText: jest.fn(async (_html: string) => true),
    postQuizToChannel: jest.fn(async (_input: { intro: string; question: string }) => true),
    escapeForTelegram: (v: string) => v,
  };
  const config = { get: (key: string) => ({ QOTD_CHANNEL_HOUR_ALMATY: 0, PUBLIC_SITE_URL: SITE })[key] };
  const redis = { set: jest.fn(async () => 'OK'), del: jest.fn(async () => 1) };
  const service = new QotdChannelService(
    telegram as unknown as TelegramBotService,
    config as unknown as ConfigService,
    redis as never,
  );
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => payload } as Response);
  try {
    const result = await service.tick();
    return { result, telegram, url: String(fetchMock.mock.calls[0]?.[0]) };
  } finally {
    fetchMock.mockRestore();
  }
}

describe('question of the day for the Telegram channel', () => {
  it('turns simple question HTML into plain text', () => {
    expect(qotdPlainText('<p>Юридическая ответственность наступает за</p>')).toBe('Юридическая ответственность наступает за');
    expect(qotdPlainText('A &amp; B<br/>C')).toBe('A & B\nC');
  });

  it('skips questions with rendered formulas (they are posted as a link instead)', () => {
    expect(qotdPlainText('<span class="katex"><span class="katex-mathml">x</span></span>')).toBeNull();
  });

  it('builds the source line only for OpenStax questions', () => {
    expect(qotdSourceHtml('openstax', SITE)).toBe(SOURCE_LINE);
    expect(qotdSourceHtml(null, SITE)).toBe('');
    expect(qotdSourceHtml(undefined, SITE)).toBe('');
  });

  it('credits OpenStax in the quiz post', async () => {
    const { result, telegram, url } = await runTick(qotd({ source: 'openstax' }));
    expect(result).toBe('posted');
    expect(url).toMatch(/^https:\/\/site\.test\/api\/qotd\?date=\d{4}-\d{2}-\d{2}$/);
    expect(telegram.notifyChannelText).not.toHaveBeenCalled();
    const { intro, question } = telegram.postQuizToChannel.mock.calls[0][0];
    expect(question).toBe('Что изучает популяционная генетика?');
    expect(intro).toContain(`${SITE}/ent/biologiya/genetika-i-selekciya`);
    expect(intro.endsWith(`\n${SOURCE_LINE}`)).toBe(true);
    // Topics have 5–10 questions now — the post must not promise a number.
    expect(intro).not.toMatch(/\d+ вопрос/);
  });

  it('credits OpenStax in the link-only post (question with formulas)', async () => {
    const { result, telegram } = await runTick(
      qotd({ source: 'openstax', stemHtml: 'Найдите <span class="katex">x</span>' }),
    );
    expect(result).toBe('posted');
    expect(telegram.postQuizToChannel).not.toHaveBeenCalled();
    const html = telegram.notifyChannelText.mock.calls[0][0];
    expect(html).toContain(`${SITE}/ent/biologiya/genetika-i-selekciya`);
    expect(html.endsWith(`\n\n${SOURCE_LINE}`)).toBe(true);
  });

  it('adds no source line when the question has no source', async () => {
    const { telegram } = await runTick(qotd());
    expect(telegram.postQuizToChannel.mock.calls[0][0].intro).not.toContain('Источник');
  });
});
