import { chromium } from './apps/web/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const out='../../outputs/qa'; await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const results=[]; const errors=[]; const api=[];
for(const width of [390,768,1440]) {
 const page=await browser.newPage({viewport:{width,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/api/'))api.push({url:r.url(),status:r.status()});});
 await page.goto('http://127.0.0.1:5173/cases/raven');
 await page.waitForSelector('.raven-stage[data-phase=idle]',{timeout:60000});
 await page.screenshot({path:`${out}/raven-${width}.png`,fullPage:true});
 results.push({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),canvas:await page.locator('canvas').count(),phase:await page.locator('.raven-stage').getAttribute('data-phase')});
 await page.close();
}
await fs.writeFile(`${out}/results.json`,JSON.stringify({results,errors,api},null,2)); await browser.close();
