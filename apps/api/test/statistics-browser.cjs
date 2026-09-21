// Local UI fixtures only: no production requests or test-account writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.WEB_TEST_URL || 'http://127.0.0.1:4320';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw Error('Local web only');
const exam = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'ent',
  name: { ru: 'ЕНТ', kk: 'ҰБТ' },
};
const subjectName = {
  ru: 'Математическая грамотность и решение практических задач',
  kk: 'Математикалық сауаттылық және практикалық есептерді шешу',
};
function report(scenario, query) {
  const empty = scenario === 'empty',
    unscored = scenario === 'unscored',
    single = scenario === 'single';
  const attempt = (i) => ({
    sessionId: `session-${i}`,
    examTypeId: exam.id,
    examName: exam.name,
    date: `2026-09-${String(i + 1).padStart(2, '0')}T20:30:00Z`,
    rawScore: unscored ? null : 70 + i,
    maxScore: 140,
    percent: unscored ? null : Math.round((70 + i) / 140 * 1000) / 10,
    status: i === 10 ? 'timed_out' : 'completed',
    language: 'ru',
    durationSecs: 3600,
    totalQuestions: 120,
  });
  const all = empty
    ? []
    : Array.from({ length: single || unscored ? 1 : 12 }, (_, i) =>
        attempt(i),
      ).reverse();
  const page = Number(query.get('page') || 1),
    latest = all[0] || null;
  return {
    exams: [exam],
    filters: Object.fromEntries(query),
    generatedAt: '2026-09-21T00:00:00Z',
    summary: {
      total: all.length,
      scored: unscored ? 0 : all.length,
      unscored: unscored ? 1 : 0,
      averagePercent: unscored || empty ? null : Math.round(all.reduce((sum, row) => sum + row.percent, 0) / all.length * 10) / 10,
      latest,
      best: unscored ? null : latest,
      deltaPercentPoints: single || empty || unscored ? null : Math.round((all[0].percent - all[1].percent) * 10) / 10,
      totalDurationSecs: 3600,
      timedOutCount: single ? 0 : 1,
    },
    chart: unscored ? [] : [...all].reverse(),
    chartLimit: 30,
    history: all.slice((page - 1) * 10, page * 10),
    page,
    pageCount: Math.max(1, Math.ceil(all.length / 10)),
    limit: 10,
    subjects: empty
      ? []
      : Array.from({ length: 8 }, (_, i) => ({
          subjectId: `subject-${i}`,
          subjectName,
          examTypeId: exam.id,
          total: i === 0 ? 2 : 20,
          correct: i === 0 ? 0 : 5 + i,
          accuracy: i === 0 ? 0 : 25 + i * 5,
        })),
  };
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of ['ru', 'kk'])
      for (const scenario of [
        'populated',
        'single',
        'empty',
        'failure',
        'unscored',
      ]) {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
        });
        await context.addInitScript((lang) => {
          localStorage.setItem('accessToken', 'statistics-fixture');
          localStorage.setItem('mytest-locale', lang);
          localStorage.setItem('mytest-theme', 'light');
        }, language);
        const page = await context.newPage(),
          errors = [],
          queries = [];
        page.setDefaultTimeout(10000);
        let failing = scenario === 'failure';
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/api/v1/**', async (route) => {
          const req = route.request(),
            url = new URL(req.url());
          if (url.pathname.endsWith('/users/me'))
            return route.fulfill({
              json: {
                id: 'fixture',
                firstName: 'Аружан',
                preferredLanguage: language,
                isChannelMember: true,
                hasActiveSubscription: false,
              },
            });
          if (url.pathname.endsWith('/users/me/statistics')) {
            assert.equal(req.headers()['accept-language'], language);
            queries.push(Object.fromEntries(url.searchParams));
            return failing
              ? route.fulfill({ status: 503, json: { message: 'fixture' } })
              : route.fulfill({ json: report(scenario, url.searchParams) });
          }
          if (url.pathname.endsWith('/exams/types'))
            return route.fulfill({ json: [exam] });
          return route.fulfill({ json: {} });
        });
        await page.goto(`${base}/dashboard/stats?lang=${language}`);
        if (scenario === 'failure') {
          const alert = page
            .getByRole('alert')
            .filter({
              hasText:
                language === 'ru'
                  ? 'Не удалось обновить'
                  : 'Статистиканы жаңарту',
            });
          await alert.waitFor();
          assert.equal(await page.getByTestId('statistics-empty').count(), 0);
          failing = false;
          await alert.getByRole('button').click();
        }
        if (scenario === 'empty')
          await page.getByTestId('statistics-empty').waitFor();
        else {
          await page.getByTestId('statistics-summary').waitFor();
          if (scenario === 'unscored')
            assert.equal(await page.getByTestId('statistics-chart').count(), 0);
          else {
            await page
              .getByTestId('statistics-chart')
              .locator('svg.recharts-surface')
              .waitFor();
            assert.equal(await page.getByTestId('statistics-chart').count(), 1);
          }
          assert.equal(
            await page
              .getByTestId('statistics-history')
              .getByRole('link')
              .first()
              .getAttribute('href'),
            `/exam/session-${scenario === 'single' || scenario === 'unscored' ? 0 : 11}/review`,
          );
        }
        for (const width of [320, 390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `Overflow ${scenario}/${language}/${width}`,
          );
        }
        if (scenario === 'populated') {
          const subjects = page.getByTestId('statistics-subjects');
          assert.equal(await subjects.locator('li').count(), 6);
          await subjects.getByRole('button').click();
          assert.equal(await subjects.locator('li').count(), 8);
          assert.ok(
            (
              await subjects.getByRole('link').first().getAttribute('href')
            ).includes(`examTypeId=${exam.id}`),
          );
          await subjects.getByRole('button').click();
          await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
          await page.screenshot({
            path: `/tmp/statistics-${language}-desktop.png`,
            fullPage: true,
            animations: 'disabled',
          });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.evaluate(() => {
            document.documentElement.classList.add('dark');
            window.scrollTo({top: 0, behavior: 'instant'});
          });
          await page.screenshot({
            path: `/tmp/statistics-${language}-mobile-dark.png`,
            fullPage: true,
            animations: 'disabled',
          });
          await page.screenshot({path: `/tmp/statistics-${language}-mobile-top.png`, animations: 'disabled'});
          const forward = page.getByRole('button', {
            name: language === 'ru' ? 'Вперёд' : 'Алға',
            exact: true,
          });
          await forward.click();
          await page.waitForFunction(
            () =>
              document.querySelector('[data-testid="statistics-history"] ul')
                ?.children.length === 2,
          );
          assert.equal(queries.at(-1).page, '2');
          await Promise.all([
            page.waitForResponse(
              (r) =>
                r.url().includes('/users/me/statistics?') &&
                new URL(r.url()).searchParams.get('period') === '30',
            ),
            page
              .getByLabel(language === 'ru' ? 'Период' : 'Кезең', {
                exact: true,
              })
              .selectOption('30'),
          ]);
          await page.getByTestId('statistics-summary').waitFor();
          assert.equal(queries.at(-1).period, '30');
          assert.equal(queries.at(-1).page, '1');
          await Promise.all([
            page.waitForResponse(
              (r) =>
                r.url().includes('/users/me/statistics?') &&
                new URL(r.url()).searchParams.get('format') === 'practice',
            ),
            page.getByLabel('Формат', { exact: true }).selectOption('practice'),
          ]);
          await page.getByTestId('statistics-summary').waitFor();
          assert.equal(queries.at(-1).format, 'practice');
          await Promise.all([
            page.waitForResponse(
              (r) =>
                r.url().includes('/users/me/statistics?') &&
                new URL(r.url()).searchParams.get('examTypeId') === exam.id,
            ),
            page
              .getByLabel(language === 'ru' ? 'Экзамен' : 'Емтихан', {
                exact: true,
              })
              .selectOption(exam.id),
          ]);
          await page.getByTestId('statistics-summary').waitFor();
          assert.equal(queries.at(-1).examTypeId, exam.id);
          await page.reload();
          await page.getByTestId('statistics-summary').waitFor();
          assert.equal(queries.at(-1).examTypeId, exam.id);
          assert.equal(queries.at(-1).format, 'practice');
        }
        assert.deepEqual(errors, []);
        console.log('STATISTICS_UI_OK', language, scenario);
        await context.close();
      }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
