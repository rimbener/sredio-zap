export default async ({ page, shot, log, text }) => {
  await page.goto('http://localhost:4200/zaps'); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Create Zap/ }).first().click(); await page.waitForSelector('mat-dialog-container');
  await page.locator('mat-dialog-container').getByText('GitHub').click();
  await page.waitForURL(/zaps\/new/); await page.waitForTimeout(2500);
  const repo = page.locator('input[formcontrolname="repo"]');
  // free text invalid
  await repo.fill('nope/nothing'); await page.waitForTimeout(500);
  log('no-results option:', await text('mat-option.no-results'));
  await page.keyboard.press('Escape'); await page.locator('input[aria-label="Zap name"]').click(); await page.waitForTimeout(300);
  log('repo error:', await text('mat-error'), '| save disabled', await page.locator('button.save').isDisabled());
  // filter, case-insensitive
  await repo.fill('ZAPS-QA'); await page.waitForTimeout(500);
  const opts = await page.locator('mat-option').allInnerTexts(); log('filtered options:', opts);
  await page.locator('mat-option', { hasText: 'rimbener/zaps-qa-sandbox' }).click(); await page.waitForTimeout(400);
  log('trigger header:', await text('.summary'));
  // name
  const name = page.locator('input[aria-label="Zap name"]'); await name.fill(''); await name.blur(); await page.waitForTimeout(300);
  log('empty name error:', await text('mat-error'), '| save disabled', await page.locator('button.save').isDisabled());
  await name.fill('x'.repeat(101)); await name.blur(); await page.waitForTimeout(300); log('101-char name error:', await text('mat-error'));
  await name.fill('QA Thank PRs');
  // action panel
  await page.getByText('2. Action · GitHub').click(); await page.waitForTimeout(600);
  const body = page.locator('textarea[formcontrolname="body"]');
  log('default body:', await body.inputValue());
  log('counter:', await text('.counter'), '| preview:', await text('.preview-body'));
  await body.fill('Thanks @{{pr.author}} for "{{pr.title}}" {{nope}}'); await body.blur(); await page.waitForTimeout(300);
  log('unknown token error:', await text('mat-error'), '| save disabled', await page.locator('button.save').isDisabled());
  await body.fill('Thanks @{{pr.author}} for "'); await body.press('End');
  await page.locator('button.insert-field').click(); await page.waitForTimeout(400);
  log('insert menu:', await text('.mat-mdc-menu-content'));
  await page.locator('.mat-mdc-menu-content button').filter({ hasText: 'pr.title' }).first().click(); await page.waitForTimeout(300);
  await body.press('End'); await body.type('" (#'); 
  await page.locator('button.insert-field').click(); await page.waitForTimeout(300);
  await page.locator('.mat-mdc-menu-content button').filter({ hasText: 'pr.number' }).first().click(); await page.waitForTimeout(300);
  await body.press('End'); await body.type(') — QA run ✅ ñ');
  log('body now:', await body.inputValue()); log('preview:', await text('.preview-body')); log('counter:', await text('.counter'));
  await shot('05-builder-filled');
  // unsaved guard: back with dirty form
  await page.locator('a[aria-label="Back to your Zaps"]').click(); await page.waitForTimeout(600);
  log('guard dialog:', await text('mat-dialog-container')); await shot('05-guard');
  await page.getByRole('button', { name: 'Keep editing' }).click(); await page.waitForTimeout(400); log('after keep editing url', page.url());
  // save
  await page.locator('button.save').click();
  await page.waitForURL(/zaps\/[0-9a-f]{24}$/, { timeout: 20000 }); await page.waitForTimeout(1500);
  log('after save url', page.url(), '| snack:', await text('mat-snack-bar-container'));
  log('toggle disabled after save?', await page.locator('mat-slide-toggle button').first().isDisabled());
  await shot('05-saved');
};
