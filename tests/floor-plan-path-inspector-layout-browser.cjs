const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const fs=require('fs');
const M=require('../js/floor-plan-model.js');
const before=process.argv.includes('--before'),viewer=process.argv.includes('--viewer');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.sample(),key='wms-floor-plan-editor-draft-v2:custom-1789604650974';
  const context=await browser.newContext({viewport:{width:1540,height:1050}});
  await context.addInitScript(({key,plan})=>localStorage.setItem(key,JSON.stringify(plan)),{key,plan});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
  await page.locator('#loginUserId').fill(viewer?'viewuser':'edituser');
  await page.locator('#loginPassword').fill(viewer?'view1234':'edit!@#$');
  await page.locator('#loginSubmitBtn').click();
  await page.locator('.fp-editor').waitFor();
  await page.locator('.fp-list [data-select=T01]').click();
  if(before){
   assert.equal(await page.locator('.fp-prop-top h3').textContent(),'선택 대상 · AMR 통로');
   assert.equal(await page.locator('.fp-pending').count(),1);
   assert.equal(await page.locator('[data-field=id]').locator('..').evaluate(el=>el.childNodes[0].textContent.trim()),'대상 코드');
   assert.equal(await page.locator('[data-field=x],[data-field=y]').count(),2);
   assert.equal(await page.getByRole('heading',{name:'경로 및 지점',exact:true}).count(),1);
   assert.equal(await page.getByRole('button',{name:'경로 전체',exact:true}).count(),1);
   assert.equal(await page.locator('[data-lock]').count(),1);
   console.log('Reproduced current path inspector title, notice, generic code, start coordinates, full-path button and bottom checkbox lock');
   return;
  }
  for(const [id,name] of [['T01','AMR 통로'],['ST01','셔틀 통로'],['CV01','컨베이어']]){
   await page.locator('.fp-list [data-select="'+id+'"]').click();
   assert.equal(await page.locator('.fp-prop-top h3').textContent(),name+' 정보');
   assert.equal(await page.locator('.fp-pending').count(),0);
   assert.equal(await page.locator('[data-field=id]').locator('..').evaluate(el=>el.childNodes[0].textContent.trim()),name+' 코드');
   assert.equal(await page.locator('[data-field=x],[data-field=y]').count(),0);
   assert.equal(await page.getByRole('heading',{name:'경로 편집',exact:true}).count(),1);
   assert.equal(await page.getByRole('button',{name:'경로 전체',exact:true}).count(),0);
   for(const label of ['경로 추가','포인트 삭제','포인트 추가'])assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),1);
   for(const label of ['선택 지점에서 분기 추가','선택 지점 삭제','구간 중간에 지점 추가'])assert.equal(await page.getByRole('button',{name:label,exact:true}).count(),0);
   assert.equal(await page.locator('[data-lock]').count(),0);
   const lock=page.locator('[data-action=togglePathLock]');
   assert.equal(await lock.count(),1);
   assert.equal((await page.locator('.fp-path-delete [data-action]').evaluateAll(elements=>elements.map(el=>el.dataset.action))).join(','),'delete,rotate');
   await lock.click();
   assert.ok(await page.locator('[data-field=width]').isDisabled());
   assert.ok(await page.locator('[data-action=delete]').isDisabled());
   assert.ok(await lock.isEnabled());
   await lock.click();
   await page.locator('[data-node="1"]').click();
   assert.equal(await page.locator('[data-field=x],[data-field=y]').count(),2);
  }
  fs.mkdirSync('output/floor-plan-path-inspector',{recursive:true});
  await page.screenshot({path:'output/floor-plan-path-inspector/'+(viewer?'viewer':'editor')+'.png',fullPage:true});
  console.log((viewer?'Viewer':'Editor')+': PASS T/ST/CV information title, code lock, compact path editing labels, point-only coordinates, left delete action');
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});