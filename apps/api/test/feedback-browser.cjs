// UI-only fixtures. Real HTTP/PostgreSQL coverage: test-feedback.http.spec.ts.
// Run against local web: WEB_TEST_URL=http://127.0.0.1:4318 node apps/api/test/feedback-browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.WEB_TEST_URL || 'http://127.0.0.1:4318';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local web only');
const session = '11111111-1111-4111-8111-111111111111';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const locale of ['ru', 'kk']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addInitScript((lang) => {
        localStorage.setItem('accessToken', 'local-ui-fixture');
        localStorage.setItem('mytest-locale', lang);
      }, locale);
      let feedback = null, shown = 0, failOnce = true;
      const errors = [];
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/v1/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        let data = {};
        if (path.endsWith('/users/me')) data = { id: 'ui-user', firstName: 'Тест', preferredLanguage: locale, isChannelMember: true };
        if (path.endsWith('/review')) data = { id: session, status: 'completed', rawScore: 80, maxScore: 140, correctCount: 60, totalQuestions: 120, metadata: {}, examType: { slug: 'ent', name: { ru: 'ЕНТ', kk: 'ҰБТ' } }, answers: [] };
        if (path.endsWith('/feedback/shown')) shown++;
        if (path.endsWith('/feedback/skip')) feedback = { submittedAt: null, skippedAt: new Date().toISOString() };
        if (path.endsWith('/feedback')) {
          if (request.method() === 'PUT') {
            const body = request.postDataJSON();
            assert.equal(body.locale, locale);
            assert.equal(body.rating, 4);
            assert.equal(body.comment, 'Оплата не открылась');
            if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { message: 'Fixture retry' } }); }
            feedback = { ...body, submittedAt: new Date().toISOString(), skippedAt: null };
          }
          data = feedback;
        }
        await route.fulfill({ json: data });
      });
      const open = () => page.goto(`${base}/exam/${session}/review?lang=${locale}`);
      await open();
      const form = page.locator('section[aria-labelledby="test-feedback-heading"]');
      await form.waitFor();
      await form.scrollIntoViewIfNeeded();
      const submit = form.locator('button[type="submit"]');
      assert.equal(await submit.isDisabled(), true);
      await form.getByRole('button', { name: '4', exact: true }).click();
      await form.locator('select').nth(0).selectOption('maybe');
      await form.locator('select').nth(1).selectOption('payment');
      await form.locator('textarea').fill('  Оплата не открылась  ');
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No overflow ${locale}/${width}`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await form.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/tmp/bilimland-feedback-${locale}.png`, fullPage: true });
      await submit.click();
      await form.getByRole('alert').waitFor();
      assert.equal(await form.locator('textarea').inputValue(), '  Оплата не открылась  ');
      await submit.click();
      await page.getByRole('status').filter({ hasText: locale === 'ru' ? 'Спасибо за отзыв' : 'Пікіріңізге рақмет' }).waitFor();
      assert.ok(shown > 0, 'Visible form recorded');
      await open();
      await page.getByRole('status').filter({ hasText: locale === 'ru' ? 'Спасибо за отзыв' : 'Пікіріңізге рақмет' }).waitFor();
      feedback = null;
      await open();
      await form.getByRole('button', { name: locale === 'ru' ? 'Пропустить' : 'Өткізу', exact: true }).click();
      await form.waitFor({ state: 'hidden' });
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/feedback')), open()]);
      assert.equal(await form.count(), 0);
      assert.deepEqual(errors, []);
      console.log(`FEEDBACK_UI_OK ${locale}: submit/retry/persistence/skip, 320/390/1280px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
