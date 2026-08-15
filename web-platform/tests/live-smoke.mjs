import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.OTHELLO_BASE_URL;
assert.ok(baseUrl, 'OTHELLO_BASE_URL is required');
const artifacts = path.resolve('output', 'live-smoke');
await fs.mkdir(artifacts, { recursive: true });

const health = await fetch(`${baseUrl}/api/health`);
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), {
  status: 'ok',
  service: 'othello-arena-edge',
  protocol: 1,
});

const opening = await fetch(`${baseUrl}/api/engine/opening`);
assert.equal(opening.status, 200);
assert.deepEqual((await opening.json()).legal_moves, [19, 26, 37, 44]);

const home = await fetch(baseUrl);
assert.equal(home.status, 200);
assert.match(home.headers.get('content-security-policy') ?? '', /default-src 'self'/);
assert.equal(home.headers.get('x-content-type-options'), 'nosniff');

const guest = await fetch(`${baseUrl}/api/auth/guest`, { method: 'POST' });
assert.equal(guest.status, 200);
const cookie = guest.headers.get('set-cookie')?.split(';', 1)[0];
assert.ok(cookie, 'guest endpoint should set a session cookie');
const me = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: cookie } });
assert.equal(me.status, 200);
assert.match((await me.json()).user.handle, /^Guest[0-9a-f]{8}$/);

const browser = await chromium.launch({ headless: true });
const firstContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const secondContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const first = await firstContext.newPage();
const second = await secondContext.newPage();
const errors = [];

for (const page of [first, second]) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${String(error)}`));
  await page.goto(`${baseUrl}/play`, { waitUntil: 'networkidle' });
}

await Promise.all([
  first.locator('#quick-match-btn').click(),
  second.locator('#quick-match-btn').click(),
]);
await Promise.all([
  first.waitForURL('**/game?id=*', { timeout: 15_000 }),
  second.waitForURL('**/game?id=*', { timeout: 15_000 }),
]);

const firstGame = new URL(first.url()).searchParams.get('id');
const secondGame = new URL(second.url()).searchParams.get('id');
assert.ok(firstGame);
assert.equal(firstGame, secondGame);

await Promise.all([
  first.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').playerRole),
  second.waitForFunction(() => JSON.parse(window.render_game_to_text?.() ?? '{}').playerRole),
]);
const clickD3 = async (page) => {
  const canvas = page.locator('.game-layout canvas');
  const box = await canvas.boundingBox();
  assert.ok(box);
  await canvas.click({ position: { x: (box.width * 3.5) / 8, y: (box.height * 2.5) / 8 } });
};

const firstRole = JSON.parse(await first.evaluate(() => window.render_game_to_text())).playerRole;
const secondRole = JSON.parse(await second.evaluate(() => window.render_game_to_text())).playerRole;
assert.deepEqual(new Set([firstRole, secondRole]), new Set(['black', 'white']));
await clickD3(firstRole === 'black' ? first : second);

await Promise.all([
  first.waitForFunction(() => JSON.parse(window.render_game_to_text()).lastMove === 19, undefined, { timeout: 10_000 }),
  second.waitForFunction(() => JSON.parse(window.render_game_to_text()).lastMove === 19, undefined, { timeout: 10_000 }),
]);

const state = JSON.parse(await first.evaluate(() => window.render_game_to_text()));
assert.equal(state.turn, 'white');
assert.deepEqual(state.score, { black: 4, white: 1 });
await first.screenshot({ path: path.join(artifacts, 'live-game.png'), fullPage: true });
assert.deepEqual(errors, []);

await firstContext.close();
await secondContext.close();
await browser.close();
console.log(`Live Cloudflare smoke passed for game ${firstGame}. Artifacts: ${artifacts}`);
