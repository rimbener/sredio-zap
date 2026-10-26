export default async ({ page, shot, log, text }) => {
  await page.goto('http://localhost:4200/zaps'); await page.waitForTimeout(1500);
  const card = page.locator('mat-card', { hasText: 'QA Thank PRs (edited)' });
  await card.locator('mat-slide-toggle button').click(); await page.waitForTimeout(3000);
  log('re-enabled:', await card.locator('mat-slide-toggle button').getAttribute('aria-checked'));
  await card.getByText('Pull request opened in').click(); await page.waitForTimeout(1500); log('card click ->', page.url());
  await page.goto('http://localhost:4200/zaps'); await page.waitForTimeout(1500);
  await page.locator('mat-card', { hasText: 'QA Thank PRs (edited)' }).locator('button:has(mat-icon:text("more_vert"))').click();
  await page.waitForTimeout(400); log('menu:', await text('.mat-mdc-menu-content'));
  await page.locator('.mat-mdc-menu-content button', { hasText: 'Delete' }).click(); await page.waitForTimeout(500);
  log('confirm:', await text('mat-dialog-container')); await shot('10-confirm');
  await page.locator('mat-dialog-container button', { hasText: /Delete/ }).click(); await page.waitForTimeout(3000);
  log('cards after delete:', await page.locator('mat-card').count(), '|', await text('mat-card'));
  // throwaway zap, deleted from builder
  await page.getByRole('button', { name: /Create Zap/ }).first().click(); await page.waitForSelector('mat-dialog-container');
  await page.locator('mat-dialog-container').getByText('GitHub').click(); await page.waitForURL(/zaps\/new/); await page.waitForTimeout(2500);
  await page.locator('input[aria-label="Zap name"]').fill('QA throwaway');
  await page.locator('input[formcontrolname="repo"]').fill('zaps-qa'); await page.waitForTimeout(400);
  await page.locator('mat-option', { hasText: 'rimbener/zaps-qa-sandbox' }).click();
  await page.locator('button.save').click(); await page.waitForURL(/zaps\/[0-9a-f]{24}$/); await page.waitForTimeout(1500);
  await page.locator('button.menu-button').click(); await page.locator('button.delete-item').click(); await page.waitForTimeout(400);
  log('builder confirm:', await text('mat-dialog-container'));
  await page.locator('mat-dialog-container button', { hasText: /Delete/ }).click(); await page.waitForTimeout(2500);
  log('after builder delete url', page.url(), '| cards:', await text('mat-card'));
  // sign out
  await page.locator('mat-toolbar button').last().click(); await page.waitForTimeout(400);
  log('avatar menu:', await text('.mat-mdc-menu-content'));
  await page.locator('.mat-mdc-menu-content button', { hasText: 'Sign out' }).click(); await page.waitForTimeout(1500);
  log('after sign out', page.url());
  log('/api/me status', await page.evaluate(async () => (await fetch('http://localhost:3000/api/me', {credentials:'include'})).status));
  await page.goto('http://localhost:4200/zaps'); await page.waitForTimeout(1000); log('/zaps after signout ->', page.url());
};
