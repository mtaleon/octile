const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 1280, height: 800 } });

test('debug keyboard cursor - detailed state check', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Start game
  await page.evaluate(() => {
    localStorage.setItem('octile_energy', JSON.stringify({ points: 5, ts: Date.now() }));
    startGame(1);
  });
  await page.waitForTimeout(500);

  // Close modals
  await page.evaluate(() => {
    const modalIds = ['multiplier-confirm-modal', 'reward-modal', 'energy-modal', 'auth-modal'];
    modalIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });
  });
  await page.waitForTimeout(100);

  // Check initial state
  const beforeState = await page.evaluate(() => ({
    inputMode: window._inputMode,
    kbCursorR: window._kbCursorR,
    kbCursorC: window._kbCursorC,
    cellsExist: !!document.querySelector('.cell[data-row="4"][data-col="3"]'),
    inGame: document.body.classList.contains('in-game'),
    gameOver: window.gameOver,
    modalOpen: (function() {
      const modalIds = ['multiplier-confirm-modal', 'reward-modal', 'energy-modal', 'auth-modal'];
      return modalIds.some(id => {
        const el = document.getElementById(id);
        return el && el.classList.contains('show');
      });
    })()
  }));
  console.log('Before arrow key:', JSON.stringify(beforeState, null, 2));

  // Press arrow key
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(50);

  // Check after state
  const afterState = await page.evaluate(() => ({
    inputMode: window._inputMode,
    kbCursorR: window._kbCursorR,
    kbCursorC: window._kbCursorC,
    hasKbCursorClass: !!document.querySelector('.cell.kb-cursor'),
    targetCellExists: !!document.querySelector('.cell[data-row="4"][data-col="3"]'),
    targetCellClasses: (function() {
      const cell = document.querySelector('.cell[data-row="4"][data-col="3"]');
      return cell ? cell.className : null;
    })()
  }));
  console.log('After arrow key:', JSON.stringify(afterState, null, 2));
});
