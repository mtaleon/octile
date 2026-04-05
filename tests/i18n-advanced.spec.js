const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// P0: Language switching, format, fallback
// ---------------------------------------------------------------------------

test.describe('Dynamic Language Switch', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('switching to zh updates all UI text without reload', async ({ page }) => {
    const result = await page.evaluate(() => {
      setLang('zh');
      applyLanguage();
      var sample = document.getElementById('settings-help-label')?.textContent || '';
      return /[\u4e00-\u9fff]/.test(sample);
    });
    expect(result).toBe(true);
    // Reset
    await page.evaluate(() => { setLang('en'); applyLanguage(); });
  });

  test('switching back to en restores English text', async ({ page }) => {
    await page.evaluate(() => { setLang('zh'); applyLanguage(); });
    const result = await page.evaluate(() => {
      setLang('en');
      applyLanguage();
      var sample = document.getElementById('settings-help-label')?.textContent || '';
      return /[\u4e00-\u9fff]/.test(sample);
    });
    expect(result).toBe(false);
  });

  test('html lang attribute updates on language switch', async ({ page }) => {
    await page.evaluate(() => { setLang('zh'); applyLanguage(); });
    const zhLang = await page.evaluate(() => document.documentElement.lang);
    expect(zhLang).toBe('zh-Hant');
    await page.evaluate(() => { setLang('en'); applyLanguage(); });
    const enLang = await page.evaluate(() => document.documentElement.lang);
    expect(enLang).toBe('en');
  });
});

test.describe('Fallback Rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('missing zh key falls back to en', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Use a key that exists in EN but test fallback mechanism
      var enVal = TRANSLATIONS.en['win_title'];
      // Temporarily remove from zh to test fallback
      var originalZh = TRANSLATIONS.zh['win_title'];
      delete TRANSLATIONS.zh['win_title'];
      setLang('zh');
      var val = t('win_title');
      // Restore
      TRANSLATIONS.zh['win_title'] = originalZh;
      setLang('en');
      return { val, enVal, matches: val === enVal };
    });
    expect(result.matches).toBe(true);
  });

  test('completely missing key returns key itself', async ({ page }) => {
    const result = await page.evaluate(() => t('this_key_definitely_does_not_exist_xyz'));
    expect(result).toBe('this_key_definitely_does_not_exist_xyz');
  });
});

test.describe('Number & Time Formatting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('formatTime produces consistent output regardless of language', async ({ page }) => {
    const result = await page.evaluate(() => {
      setLang('en');
      var en = formatTime(125);
      setLang('zh');
      var zh = formatTime(125);
      setLang('en');
      return { en, zh };
    });
    expect(result.en).toBe('2:05');
    expect(result.zh).toBe('2:05');
  });

  test('sbFormatTime consistent across languages', async ({ page }) => {
    const result = await page.evaluate(() => {
      setLang('en');
      var en = sbFormatTime(125);
      setLang('zh');
      var zh = sbFormatTime(125);
      setLang('en');
      return { en, zh };
    });
    expect(result.en).toBe(result.zh);
  });
});

test.describe('ZH Text Length Safety', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('zh delete account button text fits without overflow', async ({ page }) => {
    const result = await page.evaluate(() => {
      setLang('zh');
      var text = t('delete_account_btn');
      setLang('en');
      return { text, len: text.length };
    });
    expect(result.len).toBeLessThan(20); // reasonable button length
  });

  test('zh confirm deletion button text fits', async ({ page }) => {
    const result = await page.evaluate(() => {
      setLang('zh');
      var text = t('delete_account_confirm_btn');
      setLang('en');
      return { text, len: text.length };
    });
    expect(result.len).toBeLessThan(15);
  });
});
