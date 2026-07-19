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

test('logged-out player can start a guest session from the play page', async ({ page }) => {
  await page.route('**/api/auth/guest', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature',
        user: {
          id: 'guest_e2e',
          username: 'Guest_E2E',
          email: '',
          rating: 1200,
          rank: 'Intermediate',
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          isGuest: true,
        },
      }),
    });
  });

  await page.goto('/game');
  await page.getByRole('button', { name: /play as guest/i }).click();

  await expect(page.getByRole('heading', { name: /find an opponent and play/i })).toBeVisible();
  await expect(page.getByText('Playing as Guest_E2E')).toBeVisible();
});
