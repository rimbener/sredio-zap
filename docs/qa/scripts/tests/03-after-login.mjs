export default async ({ page, shot, log, text }) => {
  await page.goto('http://localhost:4200/zaps'); await page.waitForTimeout(2000);
  log('url', page.url()); log('page:', await text('body')); await shot('03-zaps');
  const me = await page.evaluate(async () => (await fetch('http://localhost:3000/api/me', {credentials:'include'})).text());
  log('/api/me', me);
  await page.goto('http://localhost:4200/login'); await page.waitForTimeout(1000); log('guest guard /login ->', page.url());
  await page.goto('http://localhost:4200/nonsense/route'); await page.waitForTimeout(1000); log('** ->', page.url());
  await page.goto('http://localhost:4200/'); await page.waitForTimeout(1000); log('/ ->', page.url());
};
