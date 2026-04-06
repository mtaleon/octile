const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const OUT = path.join('/Users/oouyang/ws/octile', 'screenshots-compare');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] });

  for (const [label, w, h] of [['1080p', 1920, 1080], ['1440p', 2560, 1440]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto('http://localhost:8080/?p=1', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    // Dismiss splash & tips
    await page.evaluate(() => {
      document.querySelectorAll('.tooltip, .toast, .checkin-toast, .achieve-toast, .tip-bubble, .tutorial-tip, .encourage-toast').forEach(t => t.remove());
      var at = document.getElementById('achieve-toast'); if (at) { at.classList.remove('show'); at.style.display = 'none'; }
    });
    await new Promise(r => setTimeout(r, 300));

    // Normal mode screenshot
    await page.screenshot({ path: path.join(OUT, `${label}-normal.png`) });
    console.log(`  ${label} normal saved`);

    // Activate Zen mode
    await page.evaluate(() => { document.body.classList.add('zen-mode'); });
    await new Promise(r => setTimeout(r, 800)); // let transitions settle
    await page.screenshot({ path: path.join(OUT, `${label}-zen.png`) });
    console.log(`  ${label} zen saved`);

    // Zen + stained glass
    await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('stained-glass'); });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT, `${label}-zen-stained-glass.png`) });
    console.log(`  ${label} zen stained-glass saved`);

    // Zen + cyberpunk
    await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('cyberpunk'); });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT, `${label}-zen-cyberpunk.png`) });
    console.log(`  ${label} zen cyberpunk saved`);

    // Zen + marble-gold
    await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('marble-gold'); });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(OUT, `${label}-zen-marble-gold.png`) });
    console.log(`  ${label} zen marble-gold saved`);

    await page.close();
  }
  await browser.close();
  console.log('\nDone!');
})();
