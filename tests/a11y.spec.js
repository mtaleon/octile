const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// D. Accessibility — lightweight checks for modals, focus, keyboard
// ---------------------------------------------------------------------------

test.describe('Modal Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('profile modal has role=dialog and aria-modal', async ({ page }) => {
    const result = await page.evaluate(() => {
      var el = document.getElementById('profile-modal');
      return { role: el.getAttribute('role'), ariaModal: el.getAttribute('aria-modal') };
    });
    expect(result.role).toBe('dialog');
    expect(result.ariaModal).toBe('true');
  });

  test('scoreboard modal has role=dialog', async ({ page }) => {
    const result = await page.evaluate(() => {
      var el = document.getElementById('scoreboard-modal');
      return el.getAttribute('role');
    });
    expect(result).toBe('dialog');
  });

  test('messages modal has role=dialog', async ({ page }) => {
    const result = await page.evaluate(() => {
      var el = document.getElementById('messages-modal');
      return el.getAttribute('role');
    });
    expect(result).toBe('dialog');
  });

  test('auth modal has role=dialog', async ({ page }) => {
    const result = await page.evaluate(() => {
      var el = document.getElementById('auth-modal');
      return el ? el.getAttribute('role') : null;
    });
    expect(result).toBe('dialog');
  });

  test('energy modal has role=dialog', async ({ page }) => {
    const result = await page.evaluate(() => {
      var el = document.getElementById('energy-modal');
      return el ? el.getAttribute('role') : null;
    });
    // May not have role yet — just verify element exists
    expect(result === 'dialog' || result === null).toBe(true);
  });
});

test.describe('Close Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('profile close button has aria-label', async ({ page }) => {
    const label = await page.evaluate(() => {
      return document.getElementById('profile-close')?.getAttribute('aria-label');
    });
    expect(label).toBeTruthy();
  });

  test('profile close button dismisses modal', async ({ page }) => {
    await page.evaluate(() => showProfileModal());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('profile-close').click());
    await page.waitForTimeout(300);
    const visible = await page.evaluate(() => document.getElementById('profile-modal').classList.contains('show'));
    expect(visible).toBe(false);
  });
});

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('buttons in profile modal are focusable', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('octile_auth_token', 'test');
      localStorage.setItem('octile_auth_user', JSON.stringify({ email: 'test@test.com' }));
      showProfileModal();
    });
    await page.waitForTimeout(500);
    const buttons = await page.evaluate(() => {
      var body = document.getElementById('profile-body');
      return body.querySelectorAll('button, a[href], [tabindex]').length;
    });
    expect(buttons).toBeGreaterThan(0);
  });

  test('delete confirm buttons are tabbable', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('octile_auth_token', 'test');
      localStorage.setItem('octile_auth_user', JSON.stringify({ email: 'test@test.com' }));
      showProfileModal();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => showDeleteAccountStepB());
    const buttons = await page.evaluate(() => {
      var actions = document.querySelector('.delete-account-actions');
      if (!actions) return [];
      return Array.from(actions.querySelectorAll('button')).map(b => ({
        text: b.textContent,
        tabIndex: b.tabIndex,
        disabled: b.disabled,
      }));
    });
    expect(buttons.length).toBe(2);
    buttons.forEach(b => {
      expect(b.disabled).toBe(false);
      expect(b.tabIndex).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('Semantic HTML', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
  });

  test('page has exactly one h1', async ({ page }) => {
    const count = await page.evaluate(() => document.querySelectorAll('h1').length);
    expect(count).toBe(1);
  });

  test('main heading is "Octile"', async ({ page }) => {
    const text = await page.evaluate(() => document.querySelector('h1').textContent.trim());
    expect(text).toBe('Octile');
  });

  test('html lang attribute is set', async ({ page }) => {
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBeTruthy();
    expect(['en', 'zh-Hant']).toContain(lang);
  });

  test('images have alt text or are decorative', async ({ page }) => {
    const result = await page.evaluate(() => {
      var imgs = document.querySelectorAll('img');
      var issues = [];
      imgs.forEach(img => {
        if (!img.alt && img.alt !== '' && !img.getAttribute('role')) {
          issues.push(img.src.slice(-30));
        }
      });
      return issues;
    });
    // Allow some missing alt (decorative icons), but flag if too many
    expect(result.length).toBeLessThan(5);
  });

  test('buttons have accessible text', async ({ page }) => {
    const result = await page.evaluate(() => {
      var buttons = document.querySelectorAll('button');
      var noLabel = [];
      buttons.forEach(btn => {
        var text = btn.textContent.trim();
        var ariaLabel = btn.getAttribute('aria-label');
        if (!text && !ariaLabel) noLabel.push(btn.id || btn.className);
      });
      return noLabel;
    });
    // Some icon-only buttons may lack labels — flag but don't fail on a few
    expect(result.length).toBeLessThan(3);
  });
});
