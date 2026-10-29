import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {IDENTITY} from '../src/geometry.js';

const screenshots='docs/images';
test('overview, metric alignment, layer toggles and export',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('#point-count')).not.toHaveText('—');
  await page.locator('#viewport canvas').waitFor();await page.screenshot({path:`${screenshots}/01-workspace.png`,fullPage:true});
  await page.getByRole('button',{name:'⇄ Align & merge'}).click();await page.locator('#align').click();
  await expect(page.locator('#alignment-detail')).toContainText('Accepted');await expect(page.locator('#scene-badge')).toHaveText('SHARED COORDINATE FRAME');
  await expect(page.locator('#alignment-detail')).toContainText('0.000000 m');
  await page.screenshot({path:`${screenshots}/02-alignment.png`,fullPage:true});
  await page.getByRole('button',{name:'◈ Overview'}).click();const total=await page.locator('#point-count').innerText();await page.locator('#show-b').uncheck();expect(await page.locator('#point-count').innerText()).not.toBe(total);await page.locator('#show-b').check();
  const event=page.waitForEvent('download');await page.locator('#export').click();const download=await event;const content=await fs.readFile(await download.path(),'utf8');expect(content).toContain('format ascii 1.0');expect(content).toContain('element vertex');
  expect(errors).toEqual([]);
});

test('sampled camera capture, save, reload and replay',async({page})=>{
  await page.goto('/');await page.locator('[data-page=capture]').click();await page.locator('#start-capture').click();
  await expect(page.locator('#capture-status')).toContainText('Recording',{timeout:20000});await expect.poll(async()=>page.locator('#capture-status').innerText()).toMatch(/[3-9] frames/);
  await page.locator('#stop-capture').click();await expect(page.locator('#play')).toBeEnabled();
  await page.screenshot({path:`${screenshots}/03-capture-replay.png`,fullPage:true});
  const event=page.waitForEvent('download');await page.locator('#save-capture').click();const download=await event;const path=await download.path();const recording=JSON.parse(await fs.readFile(path,'utf8'));
  expect(recording.frames.length).toBeGreaterThanOrEqual(3);expect(recording.poses).toBeNull();expect(recording.depth).toBeNull();expect(recording.frames[1].timestampMs).toBeGreaterThan(recording.frames[0].timestampMs);
  await page.locator('#load-capture').setInputFiles(path);await page.locator('#play').click();await expect(page.locator('#capture-status')).not.toContainText('Frame 1 /');
  await page.locator('#scrub').fill('0');await expect(page.locator('#capture-status')).toContainText('Frame 1 /');
});

test('invalid cloud rejected and known posed-depth frames reconstruct',async({page})=>{
  await page.goto('/');await page.locator('[data-page=merge]').click();
  await page.locator('#import-a').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"units":"feet","points":[[1,2,3]]}')});
  await expect(page.locator('#toast')).toContainText('metric');
  const data={schemaVersion:1,units:'meters',intrinsics:{width:2,height:2,fx:1,fy:1,cx:0,cy:0},frames:[{timestampMs:0,depth:[1,1,1,1],cameraToWorld:IDENTITY}]};
  await page.locator('#import-depth').setInputFiles({name:'depth.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await expect(page.locator('#point-count')).toHaveText('4');await expect(page.locator('#provenance')).toContainText('Posed-depth');
});

test('two browser clients synchronize map revisions and reconnect',async({page,context})=>{
  const peer=await context.newPage();await page.goto('/');await peer.goto('/');
  await page.locator('[data-page=merge]').click();await page.locator('#align').click();await expect(page.locator('#alignment-detail')).toContainText('Accepted');
  const key='c'.repeat(32);
  for(const client of [page,peer]){await client.locator('[data-page=sync]').click();await client.locator('#room').fill(key);await client.locator('#connect').click();await expect(client.locator('#publish')).toBeEnabled();}
  await page.locator('#publish').click();for(const client of [page,peer])await expect(client.locator('#revision')).toHaveText('01');
  await expect(peer.locator('#provenance')).toContainText('synthetic');await page.screenshot({path:`${screenshots}/04-shared-session.png`,fullPage:true});
  await peer.locator('#disconnect').click();await expect(peer.locator('#connect')).toBeEnabled();await peer.locator('#connect').click();await expect(peer.locator('#publish')).toBeEnabled();await expect(peer.locator('#revision')).toHaveText('01');
});

test('mobile layout and camera denial remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:`${screenshots}/05-mobile.png`,fullPage:true});
  await page.locator('[data-page=capture]').click();
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Permission denied','NotAllowedError');};});
  await page.locator('#start-capture').click();await expect(page.locator('#capture-status')).toContainText('Camera unavailable');await expect(page.locator('#start-capture')).toBeEnabled();
});
