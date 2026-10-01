const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLANDY_PLAYWRIGHT||'playwright');
const M=require('../js/floor-plan-model.js');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1500,height:1000}});
   const plan=M.blank();plan.width=40;plan.height=30;plan.objects=[
    {id:'GR01',kind:'GR',points:[{x:3,y:7},{x:30,y:7}],width:1.5,locked:false},
    {id:'T01',kind:'T',points:[{x:3,y:14},{x:30,y:14}],width:1.5,locked:false}
   ];
   const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';
   await context.addInitScript(({key,plan})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(plan));},{key,plan});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();
   await page.locator('.fp-editor').waitFor();
   const stored=()=>page.evaluate(key=>{const tabs=JSON.parse(localStorage.getItem(key+':tabs-v1')||'null');return tabs?.documents.find(item=>item.id===tabs.activeId)?.plan||JSON.parse(localStorage.getItem(key));},key);
   const position=async(x,y)=>{const box=await page.locator('[data-floor]').boundingBox();await page.mouse.click(box.x+box.width*x/40,box.y+box.height*y/30);};
   for(const [kind,x,y,w,h,height,route] of [['SH',8,7,1,1,.12,'GR01'],['FA',10,14,1.5,1,2,'T01'],['AMR',18,14,1,1,.25,'T01']]){
    await page.locator(`.fp-equipment-tools [data-tool=${kind}]`).click();
    assert.equal(Number(await page.locator('[data-field=w]').inputValue()),w);
    assert.equal(Number(await page.locator('[data-field=h]').inputValue()),h);
    assert.equal(Number(await page.locator('[data-field=height]').inputValue()),height);
    const choices=await page.locator('[data-field=routeId] option').allTextContents();
    assert.ok(choices.includes(route));
    assert.equal(choices.includes(kind==='SH'?'T01':'GR01'),false,'only compatible tracks appear');
    await position(x,y);
    await page.locator('[data-field=routeId]').selectOption(route);
    const item=(await stored()).objects.find(o=>o.kind===kind);
    assert.deepEqual([item.w,item.h,item.height,item.routeId],[w,h,height,route]);
    assert.equal(await page.locator(`.fp-map-object[data-kind=${kind}] .fp-object-fill`).count(),1);
   }
   await page.locator('.fp-equipment-tools [data-tool=SH]').click();
   await position(40.5,7);
   const outside=(await stored()).objects.find(o=>o.id==='SH02');
   assert.ok(outside&&outside.x>=40,'clicking the canvas beyond the grid places equipment');
   assert.equal(await page.locator('.fp-map-object[data-id=SH02]').count(),1);
   await page.locator('[data-field=x]').fill('60');
   await page.locator('[data-field=x]').press('Enter');
   assert.equal((await stored()).objects.find(o=>o.id==='SH02').x,60,'equipment can move farther outside the grid');
   await page.locator('[data-action=fit]').click();
   const canvas=await page.locator('.fp-canvas').boundingBox(),equipmentBox=await page.locator('.fp-map-object[data-id=SH02] .fp-object-fill').boundingBox();
   assert.ok(equipmentBox.x>=canvas.x&&equipmentBox.x+equipmentBox.width<=canvas.x+canvas.width,'fit includes equipment outside the grid');
   if(process.env.PLANDY_EQUIPMENT_SCREENSHOT&&editor)await page.screenshot({path:process.env.PLANDY_EQUIPMENT_SCREENSHOT});
   await page.reload();await page.locator('.fp-editor').waitFor();
   assert.equal((await stored()).objects.filter(o=>M.equipmentKinds.includes(o.kind)).length,4);
   await page.locator('.fp-equipment-list [data-select=FA01]').click();
   assert.match(await page.locator('[data-props] .fp-prop-top h3').innerText(),/Forklift AMR 정보/);
   await page.locator('[data-action=delete]').click();
   await page.locator('dialog [data-confirm]').click();
   assert.equal((await stored()).objects.some(o=>o.id==='FA01'),false);
   console.log((editor?'Editor':'Viewer')+': equipment placement outside the grid, fit, route selection, reload and deletion passed.');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
