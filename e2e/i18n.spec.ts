import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/refresh')) {
      return route.fulfill({ status: 401, json: {} });
    }
    if (url.pathname.endsWith('/landing-proof')) return route.fulfill({ json: { registeredStudents: 10, completedTrials: 20, completedTrials30d: 5, activeQuestions: 100 } });
    return route.fulfill({ json: {} });
  });
});

test('language round trip preserves current text, attributes, and URL selection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/login?lang=kk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('button', { name: 'Русский язык' }).first()).toBeVisible();
  await page.evaluate(() => {
    const label = document.createElement('p');
    label.id = 'translation-probe';
    label.textContent = '  Начать\n пробный  ';
    label.setAttribute('title', 'Начать пробный');
    document.body.append(label);
  });
  const probe = page.locator('#translation-probe');
  await expect(probe).toHaveText('Сынақты бастау');
  await page.evaluate(() => {
    const label = document.querySelector('#translation-probe')!;
    label.firstChild!.nodeValue = 'Закрыть';
    label.setAttribute('title', 'Закрыть');
  });
  await expect(probe).toHaveText('Жабу');
  await expect(probe).toHaveAttribute('title', 'Жабу');
  await page.getByRole('button', { name: 'Русский язык' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(probe).toHaveText('Закрыть');
  await expect(probe).toHaveAttribute('title', 'Закрыть');
  await expect(page).toHaveURL(/lang=ru/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(errors).toEqual([]);
});

test('selected language overrides profile and revalidates API data', async ({ page }) => {
  const languages: string[] = [];
  await page.unroute('**/api/v1/**');
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem('mytest-locale', 'kk');
  });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/users/me')) return route.fulfill({ json: { id: 'test-user', preferredLanguage: 'ru', firstName: 'Test' } });
    if (url.pathname.endsWith('/exams/types')) {
      languages.push(url.searchParams.get('lang') || '');
      return route.fulfill({ json: [] });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/dashboard/exams');
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect.poll(() => languages.includes('kk')).toBe(true);
  await page.getByRole('button', { name: 'Русский язык' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect.poll(() => languages.includes('ru')).toBe(true);
});

test('new landing copy and interpolated labels translate and restore', async ({ page }) => {
  await page.goto('/?lang=kk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.locator('h1')).not.toContainText('Сдай');
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.id = 'dynamic-probe';
    p.textContent = 'Страница 12';
    document.body.append(p);
    const untouched = document.createElement('p');
    untouched.id = 'exam-content';
    untouched.setAttribute('data-no-translate', '');
    untouched.setAttribute('title', 'Закрыть');
    untouched.textContent = 'Закрыть';
    document.body.append(untouched);
  });
  await expect(page.locator('#dynamic-probe')).toHaveText('12-бет');
  await expect(page.locator('#exam-content')).toHaveText('Закрыть');
  await expect(page.locator('#exam-content')).toHaveAttribute('title', 'Закрыть');
  await page.getByRole('button', { name: 'Русский язык' }).first().click();
  await expect(page.locator('#dynamic-probe')).toHaveText('Страница 12');
  await expect(page.locator('h1')).toContainText('Сдай');
});
