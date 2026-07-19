import { expect, test } from '@playwright/test';

test('landing page renders and navigates to the leaderboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /ranked othello.*live/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Now' })).toBeVisible();
  await page.getByRole('link', { name: 'Ranks', exact: true }).click();
  await expect(page.getByRole('heading', { name: /top 100 players/i })).toBeVisible();
});

test('mobile navigation exposes the primary routes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle menu' }).click();
  await expect(page.getByRole('navigation').last().getByRole('link', { name: 'Play' })).toBeVisible();
});
