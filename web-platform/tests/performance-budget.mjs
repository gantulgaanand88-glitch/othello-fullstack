import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const assetsDirectory = path.resolve('web', 'dist', 'assets');
const assets = await fs.readdir(assetsDirectory, { withFileTypes: true });
const files = await Promise.all(assets
  .filter((entry) => entry.isFile() && !entry.name.endsWith('.map'))
  .map(async (entry) => ({
    name: entry.name,
    bytes: (await fs.stat(path.join(assetsDirectory, entry.name))).size,
  })));

const javascriptBytes = files.filter((file) => file.name.endsWith('.js')).reduce((sum, file) => sum + file.bytes, 0);
const cssBytes = files.filter((file) => file.name.endsWith('.css')).reduce((sum, file) => sum + file.bytes, 0);

assert.ok(javascriptBytes <= 300_000, `JavaScript budget exceeded: ${javascriptBytes} > 300000 bytes`);
assert.ok(cssBytes <= 30_000, `CSS budget exceeded: ${cssBytes} > 30000 bytes`);
assert.equal(files.some((file) => /\.(png|jpe?g|gif|webp)$/i.test(file.name)), false, 'Raster assets should not block the first render');

console.log(`Performance budgets passed: ${javascriptBytes} B JavaScript, ${cssBytes} B CSS.`);
