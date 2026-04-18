import { test, expect } from '@playwright/test';

test('Forsiden skal vise FightWeek titel og Login knap', async ({ page }) => {
  // 1. Gå til forsiden
  await page.goto('/');

  // 2. Tjek at titlen "FightWeek" er synlig
  await expect(page.getByRole('heading', { name: 'FightWeek' })).toBeVisible();

  // 3. Tjek at login-knappen er der
  const loginButton = page.getByRole('button', { name: 'Log ind med Google' });
  await expect(loginButton).toBeVisible();
});

test('Mobilvisning skal se korrekt ud', async ({ page }) => {
  // Denne test kører automatisk i "Mobile Chrome" og "iPhone" via config
  await page.goto('/');
  await expect(page.getByText('Log ind for at se din træningsplan')).toBeVisible();
});
