export default async ({ page, shot, log, text }) => {
  await page.goto('http://localhost:4200/zaps'); await page.waitForURL(/login/);
  log('unauth /zaps ->', page.url());
  await page.waitForSelector('button'); log('login text:', await text('mat-card'));
  await shot('01-login');
  await page.goto('http://localhost:4200/login?error=oauth'); await page.waitForTimeout(800);
  log('error=oauth:', await text('mat-card')); await shot('01-login-oauth-error');
  await page.goto('http://localhost:4200/login?error=github_auth'); await page.waitForTimeout(800);
  log('error=github_auth:', await text('mat-card'));
  await page.goto('http://localhost:4200/zaps/new?appId=x'); await page.waitForTimeout(800); log('unauth builder ->', page.url());
  const r = await page.evaluate(async () => { const x = await fetch('http://localhost:3000/api/zaps', {credentials:'include'}); return [x.status, await x.text()]; });
  log('GET /api/zaps unauth:', r);
  await page.goto('http://localhost:4200/login');
};
