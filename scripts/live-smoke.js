import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const url=process.env.DEMO_URL||'https://vams2krish.github.io/CV-ML-SpatialSync/';
const browser=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader']});
const context=await browser.newContext({permissions:['camera'],viewport:{width:1440,height:1100}});
const page=await context.newPage();const errors=[],failedRequests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
const checks=[];
try{
  const response=await page.goto(url,{waitUntil:'networkidle',timeout:60000});assert.equal(response.status(),200);
  await expect(page.locator('#point-count')).toHaveText('29,768');checks.push('HTTPS production page, bundled assets and 3D viewer loaded');
  await page.locator('[data-page=merge]').click();await page.locator('#align').click();await expect(page.locator('#alignment-detail')).toContainText('0.000000 m');checks.push('Synthetic metric landmarks aligned with near-zero residual');
  await page.locator('[data-page=map]').click();await mkdir('docs/images',{recursive:true});await page.screenshot({path:'docs/images/06-live-demo.png',fullPage:true});
  const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadEvent;
  assert.match(await readFile(await download.path(),'utf8'),/format ascii 1\.0/);checks.push('PLY map download validated');
  await page.locator('[data-page=merge]').click();await page.locator('#import-depth').setInputFiles('examples/posed-depth.json');await expect(page.locator('#provenance')).toContainText('Synthetic depth fixture');checks.push('Synthetic posed-depth file imported and reconstructed');
  await page.locator('[data-page=capture]').click();await page.locator('#start-capture').click();await expect(page.locator('#capture-status')).toContainText('Recording',{timeout:25000});
  await expect.poll(async()=>{const text=await page.locator('#capture-status').innerText();return Number(text.match(/(\d+) frames/)?.[1]||0);},{timeout:10000}).toBeGreaterThanOrEqual(3);
  await page.locator('#stop-capture').click();await page.locator('#play').click();await expect(page.locator('#capture-status')).not.toContainText('Frame 1 /');checks.push('Simulated browser camera captured frames and replayed over HTTPS');
  assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
  const result={url,checkedAt:new Date().toISOString(),environment:'Headless Chromium with simulated camera; public GitHub Pages production frontend',status:'passed',checks,browserErrors:errors,failedRequests,limits:['No physical camera or LiDAR tested','No RGB-only SLAM implemented','Hosted coordinator not provided; two-client sync tested separately against local coordinator']};
  await writeFile('docs/live-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
