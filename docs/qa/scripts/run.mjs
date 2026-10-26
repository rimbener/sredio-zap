const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core');
import path from 'node:path';
const SHOTS = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../screenshots');
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('localhost:4200')) ?? ctx.pages()[0] ?? await ctx.newPage();
page.setDefaultTimeout(15000);
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const log = (...a) => console.log('•', ...a);
const text = async (sel) => (await page.locator(sel).allInnerTexts()).join(' | ');
const mod = await import(path.resolve(process.argv[2]));
try { await mod.default({ page, ctx, shot, log, text, browser }); }
catch (e) { console.log('ERROR', e.message.split('\n').slice(0,4).join('\n')); await shot('error'); }
finally { await browser.close().catch(()=>{}); process.exit(0); }
