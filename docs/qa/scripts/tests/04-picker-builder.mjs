export default async ({ page, shot, log, text }) => {
  await page.goto('http://localhost:4200/zaps'); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Create Zap/ }).first().click();
  await page.waitForSelector('mat-dialog-container'); await page.waitForTimeout(800);
  log('picker:', await text('mat-dialog-container')); await shot('04-picker');
  const tiles = await page.locator('mat-dialog-container [aria-disabled]').evaluateAll(els => els.map(e => e.textContent.trim().replace(/\s+/g,' ') + ' aria-disabled=' + e.getAttribute('aria-disabled')));
  log('tiles:', tiles);
  // click a coming-soon tile: should do nothing
  await page.locator('mat-dialog-container').getByText('Slack').click({ force: true }); await page.waitForTimeout(600);
  log('after Slack click, dialog open?', await page.locator('mat-dialog-container').count(), page.url());
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  log('after Esc, dialog open?', await page.locator('mat-dialog-container').count());
  // coming soon via URL
  const apps = await page.evaluate(async () => (await fetch('http://localhost:3000/api/apps', {credentials:'include'})).json());
  log('apps:', JSON.stringify(apps.map?.(a=>[a.key,a.status]) ?? apps));
  const list = apps.apps ?? apps.items ?? apps;
  const slack = list.find(a => a.key === 'slack'); const gh = list.find(a => a.key === 'github');
  await page.goto(`http://localhost:4200/zaps/new?appId=${slack.id}`); await page.waitForTimeout(1500);
  log('coming_soon appId ->', page.url(), '| snack:', await text('simple-snack-bar, mat-snack-bar-container'));
  await page.goto(`http://localhost:4200/zaps/new`); await page.waitForTimeout(1500);
  log('missing appId ->', page.url(), '| snack:', await text('mat-snack-bar-container'));
  // real flow via picker
  await page.getByRole('button', { name: /Create Zap/ }).first().click(); await page.waitForSelector('mat-dialog-container');
  await page.locator('mat-dialog-container').getByText('GitHub').click();
  await page.waitForURL(/zaps\/new\?appId=/); await page.waitForTimeout(2500);
  log('builder url', page.url());
  log('builder:', await text('body')); await shot('04-builder-new');
  const save = page.getByRole('button', { name: /^Save/ });
  log('save disabled before repo?', await save.isDisabled());
  const toggle = page.locator('mat-slide-toggle button, mat-slide-toggle input').first();
  log('toggle disabled in create?', await toggle.isDisabled());
};
