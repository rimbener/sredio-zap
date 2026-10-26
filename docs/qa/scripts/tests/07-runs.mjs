export default async ({ page, log }) => {
  await page.goto('http://localhost:4200/zaps'); await page.waitForTimeout(800);
  const r = await page.evaluate(async () => (await fetch('http://localhost:3000/api/zaps/6adf2a86949ee18986354de3/runs', {credentials:'include'})).text());
  log('runs:', r);
};
