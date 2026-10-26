export default async ({ page, shot, log, text }) => {
  await page.goto('http://localhost:4200/zaps/6adf2a86949ee18986354de3'); await page.waitForTimeout(2500);
  log('header:', await text('.header'));
  await page.locator('mat-slide-toggle button').first().click(); await page.waitForTimeout(3000);
  log('toggle checked:', await page.locator('mat-slide-toggle button').first().getAttribute('aria-checked'), '| snack:', await text('mat-snack-bar-container'));
  log('banner:', await text('.banner, .info-banner, [role=status]'));
  await shot('06-enabled');
};
