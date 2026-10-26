export default async ({ page, shot, log, text }) => {
  await page.goto('http://localhost:4200/zaps'); await page.waitForTimeout(1500);
  log('cards:', await page.locator('mat-card').count(), '| names:', await text('mat-card-title, .name'));
  const card = page.locator('mat-card', { hasText: 'QA Thank PRs (edited)' });
  await card.locator('mat-slide-toggle button').click(); await page.waitForTimeout(3000);
  log('toggle after off:', await card.locator('mat-slide-toggle button').getAttribute('aria-checked'), '| url still', page.url());
  const f = (m, u, b, ct='application/json') => page.evaluate(async ([m,u,b,ct]) => { const r = await fetch('http://localhost:3000'+u, {method:m, credentials:'include', headers: b!==undefined?{'content-type':ct}:{}, body:b}); return r.status+' '+(await r.text()).slice(0,140); }, [m,u,b,ct]);
  log('GET other:', await f('GET','/api/zaps/6adf2b183546248306beb880'));
  log('PATCH other:', await f('PATCH','/api/zaps/6adf2b183546248306beb880', JSON.stringify({name:'hacked'})));
  log('enable other:', await f('POST','/api/zaps/6adf2b183546248306beb880/enable','{}'));
  log('DELETE other:', await f('DELETE','/api/zaps/6adf2b183546248306beb880'));
  log('runs other:', await f('GET','/api/zaps/6adf2b183546248306beb880/runs'));
  log('list contains other?', (await f('GET','/api/zaps')).includes('Someone else'));
  log('POST text/plain (CSRF):', await f('POST','/api/zaps/6adf2a86949ee18986354de3/enable','{}','text/plain'));
  log('POST form (CSRF):', await f('POST','/api/zaps', 'name=x','application/x-www-form-urlencoded'));
};
