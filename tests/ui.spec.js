import { test, expect } from '@playwright/test';

test.describe('Login Skærm UI', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Skal vise korrekt overskrift og velkomsttekst', async ({ page }) => {
    // Tjek at titlen er korrekt (Browser tab titel)
    await expect(page).toHaveTitle(/FightWeek/);
    
    // Tjek at H1 overskriften er der
    await expect(page.getByRole('heading', { name: 'FightWeek', level: 1 })).toBeVisible();
    
    // Tjek instruktionsteksten
    await expect(page.getByText('Log ind for at se din træningsplan')).toBeVisible();
  });

  test('Login knap skal være tydelig og indeholde Google tekst', async ({ page }) => {
    const loginBtn = page.getByRole('button', { name: 'Log ind med Google' });
    
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toBeEnabled();
    
    // Tjek at knappen har den rigtige styling (hvid baggrund)
    await expect(loginBtn).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // Tjek at Google ikonet er indlæst (vigtigt for troværdighed)
    const googleIcon = loginBtn.locator('img[alt="Google"]');
    await expect(googleIcon).toBeVisible();
    // Tjek at src peger på et billede (ikke broken link)
    await expect(googleIcon).toHaveAttribute('src', /gstatic.*google\.svg/);
  });

});

test.describe('Mobil Responsiveness', () => {
  
  test('Skal have korrekt viewport meta tag til mobil', async ({ page }) => {
    // Dette er kritisk for at appen ligner en app og ikke en desktop-side på mobilen
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  });

  test('Logo skal være centreret', async ({ page }) => {
    await page.goto('/');
    const logoContainer = page.locator('.bg-blue-600.rounded-2xl').first();
    await expect(logoContainer).toBeVisible();
  });
});
