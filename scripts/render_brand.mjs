import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const svg = await readFile(resolve('brand/icon.svg'), 'utf8');
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`);
    await writeFile(resolve(`public/icon-${size}.png`), await page.screenshot({ omitBackground: true }));
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
  const svg = await readFile(resolve('brand/social-preview.svg'), 'utf8');
  await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`);
  await writeFile(resolve('brand/social-preview.png'), await page.screenshot());
  await page.close();
} finally {
  await browser.close();
}
