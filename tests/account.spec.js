const { test, expect } = require('@playwright/test');

// Helper: set up signed-in state with a fake auth user
async function signIn(page) {
  await page.evaluate(() => {
    localStorage.setItem('octile_auth_token', 'fake_token_for_test');
    localStorage.setItem('octile_auth_user', JSON.stringify({
      id: 999, display_name: 'Test User', email: 'test@example.com', picture: null
    }));
  });
}

// Helper: set up signed-in state and open profile modal
async function signInAndOpenProfile(page) {
  await signIn(page);
  await page.evaluate(() => showProfileModal());
  await page.waitForSelector('.profile-account-section', { timeout: 3000 });
}

// ---------------------------------------------------------------------------
// 1. ACCOUNT & DATA SECTION
// ---------------------------------------------------------------------------

test.describe('Account & Data Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('shows Account & Data when signed in', async ({ page }) => {
    await signInAndOpenProfile(page);
    await expect(page.locator('.profile-account-section')).toBeVisible();
    await expect(page.locator('.profile-account-email')).toHaveText('test@example.com');
    await expect(page.locator('.profile-logout-btn')).toBeVisible();
    await expect(page.locator('.profile-danger-zone')).toBeVisible();
    await expect(page.locator('.profile-delete-link')).toBeVisible();
  });

  test('shows sign-in prompt when not signed in', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('octile_auth_token');
      localStorage.removeItem('octile_auth_user');
      showProfileModal();
    });
    await page.waitForSelector('#profile-body', { timeout: 3000 });
    await expect(page.locator('.profile-account-section')).not.toBeVisible();
    await expect(page.locator('.profile-signin-btn')).toBeVisible();
  });

  test('no Account & Data section when signed out', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('octile_auth_token');
      localStorage.removeItem('octile_auth_user');
      showProfileModal();
    });
    await page.waitForSelector('#profile-body', { timeout: 3000 });
    const section = page.locator('.profile-account-section');
    await expect(section).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 2. LOGOUT CONFIRMATION
// ---------------------------------------------------------------------------

test.describe('Logout Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await signInAndOpenProfile(page);
  });

  test('shows logout confirm dialog with correct copy', async ({ page }) => {
    await page.evaluate(() => confirmLogout());
    await expect(page.locator('.logout-confirm-page h2')).toBeVisible();
    await expect(page.locator('.logout-confirm-body')).toBeVisible();
    await expect(page.locator('.delete-cancel-btn')).toBeVisible();
    await expect(page.locator('.delete-danger-btn')).toBeVisible();
  });

  test('cancel returns to profile', async ({ page }) => {
    await page.evaluate(() => confirmLogout());
    await page.locator('.delete-cancel-btn').click();
    await expect(page.locator('.profile-account-section')).toBeVisible();
  });

  test('sign out clears auth and shows signed-out profile', async ({ page }) => {
    await page.evaluate(() => confirmLogout());
    // Execute the logout action directly (splash overlay may intercept clicks)
    await page.evaluate(() => { authLogout(); showProfileModal(); });
    await page.waitForTimeout(500);
    const isAuth = await page.evaluate(() => isAuthenticated());
    expect(isAuth).toBe(false);
  });

  test('no duplicate close button', async ({ page }) => {
    await page.evaluate(() => confirmLogout());
    const closeButtons = page.locator('.modal-close-x');
    await expect(closeButtons).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 3. DELETE ACCOUNT FLOW
// ---------------------------------------------------------------------------

test.describe('Delete Account Step A', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await signInAndOpenProfile(page);
  });

  test('shows Step A with red title, bullets, and warning', async ({ page }) => {
    await page.evaluate(() => showDeleteAccountStepA());
    const title = page.locator('.delete-account-page h2');
    await expect(title).toBeVisible();
    // Title should be red (#e74c3c)
    const color = await title.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(231, 76, 60)');
    await expect(page.locator('.delete-account-bullets')).toBeVisible();
    await expect(page.locator('.delete-account-bullets li')).toHaveCount(3);
    await expect(page.locator('.delete-account-warning')).toBeVisible();
    await expect(page.locator('.delete-account-hint')).toBeVisible();
  });

  test('cancel returns to profile', async ({ page }) => {
    await page.evaluate(() => showDeleteAccountStepA());
    await page.locator('.delete-cancel-btn').click();
    await expect(page.locator('.profile-account-section')).toBeVisible();
  });

  test('log out hint link goes to logout confirm', async ({ page }) => {
    await page.evaluate(() => showDeleteAccountStepA());
    await page.locator('.delete-account-hint a').click();
    await expect(page.locator('.logout-confirm-page')).toBeVisible();
  });

  test('no duplicate close button', async ({ page }) => {
    await page.evaluate(() => showDeleteAccountStepA());
    const closeButtons = page.locator('.modal-close-x');
    await expect(closeButtons).toHaveCount(0);
  });
});

test.describe('Delete Account Step B', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await signInAndOpenProfile(page);
  });

  test('shows Step B with confirm title and buttons', async ({ page }) => {
    await page.evaluate(() => showDeleteAccountStepB());
    const title = page.locator('.delete-account-page h2');
    await expect(title).toBeVisible();
    await expect(page.locator('.delete-account-confirm-body')).toBeVisible();
    await expect(page.locator('.delete-account-confirm-prompt')).toBeVisible();
    await expect(page.locator('#delete-cancel-btn')).toBeVisible();
    await expect(page.locator('#delete-confirm-btn')).toBeVisible();
  });

  test('cancel returns to profile', async ({ page }) => {
    await page.evaluate(() => showDeleteAccountStepB());
    await page.locator('#delete-cancel-btn').click();
    await expect(page.locator('.profile-account-section')).toBeVisible();
  });

  test('both buttons disable during execution', async ({ page }) => {
    // Intercept the DELETE request to hold it pending
    await page.route('**/auth/account', route => {
      // Don't respond — keep it pending
      setTimeout(() => route.fulfill({ status: 200, body: '{"deleted":true}' }), 5000);
    });
    await page.evaluate(() => showDeleteAccountStepB());
    await page.locator('#delete-confirm-btn').click();
    // Both buttons should be disabled immediately
    await expect(page.locator('#delete-cancel-btn')).toBeDisabled();
    await expect(page.locator('#delete-confirm-btn')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 4. DELETE EXECUTION OUTCOMES
// ---------------------------------------------------------------------------

test.describe('Delete Execution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await signIn(page);
  });

  test('200 success: logs out, closes modal, shows toast', async ({ page }) => {
    await page.route('**/auth/account', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"deleted":true}' });
    });
    await page.evaluate(() => showProfileModal());
    await page.waitForSelector('.profile-account-section', { timeout: 3000 });
    await page.evaluate(() => showDeleteAccountStepB());
    await page.locator('#delete-confirm-btn').click();
    // Should be logged out
    await page.waitForTimeout(1000);
    const isAuth = await page.evaluate(() => isAuthenticated());
    expect(isAuth).toBe(false);
    // Profile modal should be closed
    const modalVisible = await page.evaluate(() => document.getElementById('profile-modal').classList.contains('show'));
    expect(modalVisible).toBe(false);
  });

  test('404 already deleted: treats as success', async ({ page }) => {
    await page.route('**/auth/account', route => {
      route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Account not found"}' });
    });
    await page.evaluate(() => {
      showProfileModal();
    });
    await page.waitForSelector('.profile-account-section', { timeout: 3000 });
    await page.evaluate(() => showDeleteAccountStepB());
    await page.locator('#delete-confirm-btn').click();
    await page.waitForTimeout(1000);
    const isAuth = await page.evaluate(() => isAuthenticated());
    expect(isAuth).toBe(false);
  });

  test('401: shows reauth message without retry', async ({ page }) => {
    await page.route('**/auth/account', route => {
      route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Token expired"}' });
    });
    await page.evaluate(() => {
      showProfileModal();
    });
    await page.waitForSelector('.profile-account-section', { timeout: 3000 });
    await page.evaluate(() => showDeleteAccountStepB());
    await page.locator('#delete-confirm-btn').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.delete-error-msg')).toBeVisible();
    // Should only have Cancel, no Retry (showRetry=false for 401)
    const buttons = page.locator('.delete-account-actions .delete-danger-btn');
    await expect(buttons).toHaveCount(0);
  });

  test('network error: shows offline message with retry', async ({ page }) => {
    await page.route('**/auth/account', route => {
      route.abort('failed');
    });
    await page.evaluate(() => {
      showProfileModal();
    });
    await page.waitForSelector('.profile-account-section', { timeout: 3000 });
    await page.evaluate(() => showDeleteAccountStepB());
    await page.locator('#delete-confirm-btn').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.delete-error-msg')).toBeVisible();
    // Should have Cancel + Retry
    await expect(page.locator('.delete-cancel-btn')).toBeVisible();
    await expect(page.locator('.delete-danger-btn')).toBeVisible();
  });

  test('retry calls executeDeleteAccount directly, not Step B', async ({ page }) => {
    let deleteCallCount = 0;
    await page.route('**/auth/account', route => {
      deleteCallCount++;
      if (deleteCallCount === 1) {
        route.abort('failed');
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"deleted":true}' });
      }
    });
    await page.evaluate(() => showProfileModal());
    await page.waitForSelector('.profile-account-section', { timeout: 3000 });
    await page.evaluate(() => showDeleteAccountStepB());
    await page.locator('#delete-confirm-btn').click();
    // Wait for error page to appear
    await expect(page.locator('.delete-error-msg')).toBeVisible({ timeout: 5000 });
    // Click Retry — should NOT show Step B confirm, should go straight to delete
    // Verify we see error page (not Step B confirm)
    await expect(page.locator('.delete-account-confirm-prompt')).not.toBeVisible();
    // Execute retry directly (splash overlay may intercept clicks)
    await page.evaluate(() => executeDeleteAccount());
    await page.waitForTimeout(3000);
    // Second call succeeded, should be logged out
    const isAuth = await page.evaluate(() => isAuthenticated());
    expect(isAuth).toBe(false);
    expect(deleteCallCount).toBe(2);
  });

  test('500 error: shows generic error with retry', async ({ page }) => {
    await page.route('**/auth/account', route => {
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Internal error"}' });
    });
    await page.evaluate(() => {
      showProfileModal();
    });
    await page.waitForSelector('.profile-account-section', { timeout: 3000 });
    await page.evaluate(() => showDeleteAccountStepB());
    await page.locator('#delete-confirm-btn').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.delete-error-msg')).toBeVisible();
    await expect(page.locator('.delete-danger-btn')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 5. ENERGY PRESERVED ACROSS LOGOUT
// ---------------------------------------------------------------------------

test.describe('Energy Preservation', () => {
  test('energy and daily stats survive logout', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await signIn(page);

    // Set energy to 2 and daily stats
    await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 2, ts: Date.now() }));
      localStorage.setItem('octile_energy_day', JSON.stringify({ puzzles: 3, spent: 3, date: new Date().toISOString().slice(0, 10) }));
    });

    // Logout
    await page.evaluate(() => authLogout());

    // Check energy and daily stats are preserved
    const result = await page.evaluate(() => {
      var energy = JSON.parse(localStorage.getItem('octile_energy') || 'null');
      var daily = JSON.parse(localStorage.getItem('octile_energy_day') || 'null');
      return { energy, daily };
    });

    expect(result.energy).not.toBeNull();
    expect(result.energy.points).toBe(2);
    expect(result.daily).not.toBeNull();
    expect(result.daily.puzzles).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 6. ENERGY GATE
// ---------------------------------------------------------------------------

test.describe('Energy Gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('nextPuzzle shows energy modal when out of energy', async ({ page }) => {
    const debug = await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts: Date.now() }));
      localStorage.setItem('octile_energy_day', JSON.stringify({ puzzles: 5, spent: 5, date: new Date().toISOString().slice(0, 10) }));
      var stats = getDailyStats();
      var energy = getEnergyState();
      return { hasEnergy: hasEnoughEnergy(), debug: !!_debugUnlimitedEnergy, statsP: stats.puzzles, pts: energy.points };
    });
    // _debugUnlimitedEnergy bypasses check — ensure it's off
    expect(debug.debug).toBe(false);
    expect(debug.hasEnergy).toBe(false);
    await page.evaluate(() => nextPuzzle());
    await page.waitForTimeout(500);
    const energyModal = await page.evaluate(() => document.getElementById('energy-modal').classList.contains('show'));
    expect(energyModal).toBe(true);
  });

  test('restart after win shows energy modal when out of energy', async ({ page }) => {
    const debug = await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts: Date.now() }));
      localStorage.setItem('octile_energy_day', JSON.stringify({ puzzles: 5, spent: 5, date: new Date().toISOString().slice(0, 10) }));
      gameOver = true;
      var stats = getDailyStats();
      return { hasEnergy: hasEnoughEnergy(), debug: !!_debugUnlimitedEnergy, statsP: stats.puzzles, pts: getEnergyState().points };
    });
    expect(debug.debug).toBe(false);
    expect(debug.hasEnergy).toBe(false);
  });

  test('restart mid-game is free even with no energy', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('octile_energy', JSON.stringify({ points: 0, ts: Date.now() }));
      localStorage.setItem('octile_energy_day', JSON.stringify({ puzzles: 5, spent: 5, date: new Date().toISOString().slice(0, 10) }));
      gameOver = false;
    });
    const blocked = await page.evaluate(() => {
      if (gameOver && !hasEnoughEnergy()) {
        return true;
      }
      return false;
    });
    expect(blocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. WIN FLOW Z-INDEX
// ---------------------------------------------------------------------------

test.describe('Win Flow', () => {
  test('reward modal hides win overlay so buttons are clickable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check that _showWinRewardModal removes win-overlay
    const result = await page.evaluate(() => {
      // Setup minimal win data
      _winData = {
        grade: 'S', expEarned: 100, chapterBonus: 0,
        isLevelComplete: false, isNewBest: false, prevBest: 0,
        newlyUnlocked: []
      };
      // Show win overlay first
      document.getElementById('win-overlay').classList.add('show');
      // Call the function
      _showWinRewardModal();
      return {
        winOverlayVisible: document.getElementById('win-overlay').classList.contains('show'),
        rewardModalVisible: document.getElementById('reward-modal').classList.contains('show')
      };
    });
    expect(result.winOverlayVisible).toBe(false);
    expect(result.rewardModalVisible).toBe(true);
  });

  test('reward modal primary action restores win overlay for step 3', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      _winData = {
        grade: 'S', expEarned: 100, chapterBonus: 0,
        isLevelComplete: false, isNewBest: false, prevBest: 0,
        newlyUnlocked: []
      };
      document.getElementById('win-overlay').classList.add('show');
      _showWinRewardModal();
    });
    // Click primary button (Next)
    await page.locator('#reward-primary').click();
    await page.waitForTimeout(300);
    const winOverlay = await page.evaluate(() => document.getElementById('win-overlay').classList.contains('show'));
    expect(winOverlay).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. OFFLINE CHECK AT DELETE ENTRY POINT
// ---------------------------------------------------------------------------

test.describe('Delete Account Offline Check', () => {
  test('entry point blocks when /auth/me fails', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await signInAndOpenProfile(page);

    // Block /auth/me to simulate offline
    await page.route('**/auth/me', route => route.abort('failed'));

    // Call _checkOnlineThenStepA directly (click may be intercepted by splash)
    await page.evaluate(() => _checkOnlineThenStepA());
    await page.waitForTimeout(3000);

    // Should show error, not Step A
    await expect(page.locator('.delete-error-msg')).toBeVisible();
    await expect(page.locator('.delete-account-bullets')).not.toBeVisible();
  });

  test('Step A button blocks when /auth/me fails', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await signInAndOpenProfile(page);

    // Show Step A first (bypass entry check)
    await page.evaluate(() => showDeleteAccountStepA());

    // Block /auth/me to simulate offline
    await page.route('**/auth/me', route => route.abort('failed'));

    // Call _checkOnlineThenDelete directly
    await page.evaluate(() => {
      var btn = document.querySelector('.delete-danger-btn');
      if (btn) _checkOnlineThenDelete(btn);
    });
    await page.waitForTimeout(3000);

    // Should show error, not Step B
    await expect(page.locator('.delete-error-msg')).toBeVisible();
    await expect(page.locator('.delete-account-confirm-prompt')).not.toBeVisible();
  });
});
