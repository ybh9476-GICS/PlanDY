const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const M=require('../js/floor-plan-model.js');
const before=process.argv.includes('--before');
const baseUrl=process.env.PLANDY_TEST_URL||'http://127.0.0.1:4173';

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.blank();
  plan.objects=[
   {id:'BT01',kind:'BT',x:4,y:4,w:3,h:2,angle:0,conveyorId:'CV01',offset:3.5,locked:false},
   {id:'CV01',kind:'CV',points:[{x:2,y:5},{x:10,y:5}],width:2,cap:'butt',branches:[],locked:false},
   {id:'B01',kind:'B',x:15,y:15,w:2,h:2,angle:0,locked:false},
   {id:'B02',kind:'B',x:20,y:15,w:2,h:2,angle:0,locked:false}
  ];
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1500,height:1050}});
   const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';
   await context.addInitScript(({key,plan})=>{localStorage.setItem(key,JSON.stringify(plan));localStorage.removeItem(key+':tabs-v1');},{key,plan});
   const page=await context.newPage();
   await page.goto(baseUrl+'/#custom-1789604650974');
   await page.waitForTimeout(1000);
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();
   await page.locator('.fp-editor').waitFor();
   assert.deepEqual(await page.locator('.fp-left > h3').allTextContents(),['배치 도구','도면 배치 목록']);
   assert.deepEqual(await page.locator('.fp-tool-section > h4').allTextContents(),['물류 설비','물류 장비']);
   assert.equal(await page.locator('[data-target-category=placement] > h4').count(),0);
   assert.deepEqual(await page.locator('.fp-list [data-select]').evaluateAll(elements=>elements.map(el=>el.dataset.select)),['CV01','BT01','B01','B02'],'the visible list follows placement-tool groups');
   assert.deepEqual(await page.locator('.fp-list-group').evaluateAll(elements=>elements.map(el=>el.dataset.kind)),['CV','BT','B']);
   assert.deepEqual(await page.locator('.fp-list-group h5').allTextContents(),['컨베이어','스캔 터널','버퍼']);
   assert.equal(await page.locator('[data-target-category=placement]').isVisible(),true);
   assert.equal(await page.locator('[data-target-category=equipment]').isHidden(),true);
   const groupTops=await page.locator('.fp-list-group').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().top));
   assert.ok(groupTops[0]<groupTops[1]&&groupTops[1]<groupTops[2],'each tool kind begins on a new row');
   assert.equal(Math.round((await page.locator('.fp-left').boundingBox()).width),212);
   const toolTops=await page.locator('.fp-tools button').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().top));
   assert.equal(toolTops[0],toolTops[4]);assert.ok(toolTops[5]>toolTops[4],'five tools fit on the first row');
   assert.deepEqual(await page.locator('.fp-equipment-tools button').evaluateAll(elements=>elements.map(el=>[el.getBoundingClientRect().width,el.getBoundingClientRect().height,el.textContent.trim(),!!el.querySelector('svg')])),[[36,36,'',true],[36,36,'',true]]);
   const layerOrder=await page.locator('[data-map] [data-id]').evaluateAll(elements=>elements.map(el=>el.dataset.id).filter(id=>id==='BT01'||id==='CV01'));
   assert.deepEqual(layerOrder,before?['BT01','CV01']:['CV01','BT01'],before?'current CV layer covers BT':'BT renders after CV');
   await page.locator('.fp-list [data-select=CV01]').click();
   const box=await page.locator('[data-id=BT01] > polygon').boundingBox();
   await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
   const selected=await page.locator('.fp-list [aria-pressed=true]').getAttribute('data-select');
   assert.equal(selected,before?'CV01':'BT01',before?'current CV segment hit blocks BT selection':'overlap click selects visible BT');
   await page.locator('.fp-list [data-select=B01]').click();
   await page.locator('[data-field=id]').fill('B09');
   await page.locator('[data-field=id]').press('Enter');
   assert.deepEqual(await page.locator('.fp-list-group[data-kind=B] [data-select]').evaluateAll(elements=>elements.map(el=>el.dataset.select)),['B02','B09'],'renaming immediately updates numeric order');
   console.log((editor?'Editor':'Viewer')+': '+(before?'REPRODUCED CV above BT':'PASS BT above CV; five-tool panel, equipment icons and grouped list'));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
