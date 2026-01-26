const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const url = process.argv[2] || 'http://localhost:5173/';
  const outDir = process.argv[3] || 'scripts/monitor-output';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const logs = [];
  page.on('console', (msg) => {
    const text = `[console.${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });
  page.on('pageerror', (err) => {
    const text = `[pageerror] ${err.message}`;
    logs.push(text);
    console.error(text);
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${outDir}/screenshot.png`, fullPage: true });
  } catch (e) {
    console.error('Error visiting page:', e && e.message);
  }

  fs.writeFileSync(`${outDir}/console.log`, logs.join('\n'));
  await browser.close();
  console.log('monitor complete, output in', outDir);
})();
