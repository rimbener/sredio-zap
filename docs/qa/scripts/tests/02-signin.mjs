export default async ({ page, shot, log, text }) => {
  await page.goto('http://localhost:4200/login');
  await page.bringToFront();
  await page.getByRole('button', { name: /Sign in with GitHub/ }).click();
  await page.waitForURL('http://localhost:4200/zaps', { timeout: 300000 });
  await page.waitForTimeout(1500);
  log('landed', page.url()); log('page:', await text('body')); await shot('02-zaps-after-login');
  const me = await page.evaluate(async () => (await fetch('http://localhost:3000/api/me', {credentials:'include'})).text());
  log('/api/me', me);
  await page.goto('http://localhost:4200/login'); await page.waitForTimeout(800); log('guest guard /login ->', page.url());
  await page.goto('http://localhost:4200/nonsense/route'); await page.waitForTimeout(800); log('** ->', page.url());
};
