import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.OTHELLO_BASE_URL ?? 'http://127.0.0.1:4173';
const artifacts = path.resolve('output', 'visual-smoke');
await fs.mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];

async function newPage(viewport) {
  const page = await browser.newPage({ viewport });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${String(error)}`));
  return page;
}

try {
  const desktop = await newPage({ width: 1440, height: 1000 });
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' });
  await desktop.screenshot({ path: path.join(artifacts, 'landing-desktop.png'), fullPage: true });
  await assert.doesNotReject(() => desktop.getByRole('heading', { level: 1 }).waitFor());
  assert.match(await desktop.getByRole('heading', { level: 1 }).innerText(), /every move/i);
  await assert.doesNotReject(() => desktop.getByLabel('Othello Arena home').first().waitFor());

  await desktop.locator('#start-btn').click();
  await desktop.locator('#quick-match-btn').click();
  await desktop.waitForURL('**/game');
  await desktop.screenshot({ path: path.join(artifacts, 'game-desktop.png'), fullPage: true });

  const before = JSON.parse(await desktop.evaluate(() => window.render_game_to_text()));
  assert.equal(before.turn, 'black');
  assert.equal(before.legalMoves.length, 4);

  const canvas = desktop.locator('.game-layout canvas');
  const box = await canvas.boundingBox();
  assert.ok(box, 'game canvas should have a bounding box');
  await canvas.click({
    position: { x: (box.width * 3.5) / 8, y: (box.height * 2.5) / 8 },
  });
  const after = JSON.parse(await desktop.evaluate(() => window.render_game_to_text()));
  assert.equal(after.turn, 'white');
  assert.equal(after.lastMove, 19);
  assert.deepEqual(after.score, { black: 4, white: 1 });
  await desktop.screenshot({ path: path.join(artifacts, 'game-after-move.png'), fullPage: true });
  await desktop.close();

  const mobile = await newPage({ width: 390, height: 844 });
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: path.join(artifacts, 'landing-mobile.png'), fullPage: true });
  assert.equal(await mobile.locator('body').evaluate((body) => body.scrollWidth <= window.innerWidth), true);
  await mobile.getByRole('button', { name: 'Open menu' }).click();
  await mobile.getByRole('navigation', { name: 'Primary navigation' }).waitFor();
  await mobile.screenshot({ path: path.join(artifacts, 'mobile-menu.png') });
  await mobile.getByRole('button', { name: 'Close menu' }).click();
  await mobile.goto(`${baseUrl}/game`, { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: path.join(artifacts, 'game-mobile.png'), fullPage: true });
  assert.equal(await mobile.locator('body').evaluate((body) => body.scrollWidth <= window.innerWidth), true);
  await mobile.close();

  assert.deepEqual(errors, []);
  console.log(`Visual smoke tests passed. Artifacts: ${artifacts}`);
} finally {
  await browser.close();
}
