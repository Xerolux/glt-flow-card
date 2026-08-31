import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('docs/images', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });

async function open(path) {
  await page.goto(`http://127.0.0.1:4173${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
}

async function theme(name) {
  await page.evaluate((value) => {
    document.body.dataset.theme = value;
    const select = document.querySelector('#appearance');
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, name);
  await page.waitForTimeout(300);
}

await open('/');
for (const [name, file] of [
  ['neo2030', 'neo2030-dark-live.png'],
  ['operations_light', 'neo2030-light-live.png'],
  ['classic_scada', 'classic-scada-live.png'],
  ['pid_dark', 'pid-dark-live.png'],
  ['clean', 'clean-live.png'],
]) {
  await theme(name);
  await page.locator('.glt-screen').screenshot({ path: `docs/images/${file}` });
}

await theme('neo2030');
await page.locator('#symbols').screenshot({ path: 'docs/images/symbol-library-live.png' });

await open('/editor/');
await theme('neo2030');
await page.locator('.app').screenshot({ path: 'docs/images/designer-dark-live.png' });
await theme('operations_light');
await page.locator('.app').screenshot({ path: 'docs/images/designer-light-live.png' });

await browser.close();
