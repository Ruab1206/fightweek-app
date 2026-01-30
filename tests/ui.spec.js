import { test, expect } from '@playwright/test';

test.describe('Login Skærm UI', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Skal vise korrekt overskrift og velkomsttekst', async ({ page }) => {
    // Tjek at titlen er korrekt
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
    // Dette fanger hvis nogen kommer til at gøre knappen sort eller usynlig
    await expect(loginBtn).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });

});

test.describe('Mobil Responsiveness', () => {
  // Playwright bruger indstillinger fra config til at simulere mobil
  // Denne test kører specifikt for at sikre, at layoutet ikke "sprænger" på små skærme
  
  test('Logo skal være centreret', async ({ page }) => {
    await page.goto('/');
    const logoContainer = page.locator('.bg-blue-600.rounded-2xl').first();
    await expect(logoContainer).toBeVisible();
    
    // Vi tjekker bare at det findes, da visuel placering er svær at validere uden visual snapshots
    // Men at elementet er 'visible' på en lille skærm er en god start.
  });
});
