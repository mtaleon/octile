const { test, expect } = require('@playwright/test');

test.describe('Translation System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('t() returns English text by default', async ({ page }) => {
    const result = await page.evaluate(() => t('win_title'));
    expect(result).not.toBe('win_title'); // should not return the key
    expect(result.length).toBeGreaterThan(0);
  });

  test('t() returns key as fallback for unknown keys', async ({ page }) => {
    const result = await page.evaluate(() => t('nonexistent_key_xyz'));
    expect(result).toBe('nonexistent_key_xyz');
  });

  test('setLang switches to Chinese', async ({ page }) => {
    const result = await page.evaluate(() => {
      setLang('zh');
      return { lang: currentLang, sample: t('win_title') };
    });
    expect(result.lang).toBe('zh');
    // Chinese text should contain CJK characters
    expect(/[\u4e00-\u9fff]/.test(result.sample)).toBe(true);
  });

  test('setLang switches back to English', async ({ page }) => {
    const result = await page.evaluate(() => {
      setLang('zh');
      setLang('en');
      return { lang: currentLang, sample: t('win_title') };
    });
    expect(result.lang).toBe('en');
    expect(/[\u4e00-\u9fff]/.test(result.sample)).toBe(false);
  });

  test('language persists to localStorage', async ({ page }) => {
    await page.evaluate(() => setLang('zh'));
    const stored = await page.evaluate(() => localStorage.getItem('octile_lang'));
    expect(stored).toBe('zh');
    // Reset
    await page.evaluate(() => setLang('en'));
  });

  test('translations cached to localStorage for offline', async ({ page }) => {
    const cached = await page.evaluate(() => {
      var raw = localStorage.getItem('octile_translations_cache');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return { hasEn: !!parsed.en, hasZh: !!parsed.zh, enKeys: Object.keys(parsed.en).length };
    });
    expect(cached).not.toBeNull();
    expect(cached.hasEn).toBe(true);
    expect(cached.hasZh).toBe(true);
    expect(cached.enKeys).toBeGreaterThan(50);
  });

  test('applyLanguage updates data-i18n elements', async ({ page }) => {
    await page.evaluate(() => {
      setLang('en');
      applyLanguage();
    });
    // Check a known element that has data-i18n
    const text = await page.evaluate(() => document.getElementById('settings-help-label')?.textContent);
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
  });

  test('new account/delete keys exist in both languages', async ({ page }) => {
    const keys = [
      'account_data', 'signed_in_as', 'logout_helper', 'logout_confirm_title',
      'logout_confirm_body', 'danger_zone', 'delete_account', 'delete_account_helper',
      'delete_account_bullet_1', 'delete_account_bullet_2', 'delete_account_bullet_3',
      'delete_account_irreversible', 'delete_account_btn', 'delete_account_confirm_title',
      'delete_account_confirm_body', 'delete_account_confirm_btn', 'delete_account_success',
      'delete_account_error', 'delete_account_reauth', 'delete_account_offline',
      'cancel', 'retry', 'ok',
    ];
    const result = await page.evaluate((keys) => {
      var missing = { en: [], zh: [] };
      for (var i = 0; i < keys.length; i++) {
        if (!TRANSLATIONS.en[keys[i]]) missing.en.push(keys[i]);
        if (!TRANSLATIONS.zh[keys[i]]) missing.zh.push(keys[i]);
      }
      return missing;
    }, keys);
    expect(result.en).toEqual([]);
    expect(result.zh).toEqual([]);
  });
});
