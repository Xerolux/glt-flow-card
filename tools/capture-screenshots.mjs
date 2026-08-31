import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('docs/images', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });

async function open(path) {
  await page.goto(`http://127.0.0.1:4173${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
}

await open('/');
await page.locator('.glt-screen').screenshot({ path: 'docs/images/neo2030-live.png' });
await page.evaluate(() => document.body.dataset.theme = 'operations_light');
await page.waitForTimeout(200);
await page.locator('.glt-screen').screenshot({ path: 'docs/images/operations-light-live.png' });
await page.evaluate(() => document.body.dataset.theme = 'pid_dark');
await page.waitForTimeout(200);
await page.locator('.glt-screen').screenshot({ path: 'docs/images/pid-dark-live.png' });
await page.evaluate(() => document.body.dataset.theme = 'neo2030');
await page.locator('#symbols').screenshot({ path: 'docs/images/symbol-library-live.png' });

await open('/editor/');
await page.locator('.app').screenshot({ path: 'docs/images/designer-live.png' });

await browser.close();
