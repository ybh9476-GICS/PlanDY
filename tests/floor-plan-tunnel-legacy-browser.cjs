const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const M=require('../js/floor-plan-model.js');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.blank();plan.width=50;plan.height=50;
  plan.objects=[
   {id:'CV01',kind:'CV',points:[{x:5,y:10},{x:25,y:10}],branches:[{id:'B1',from:1,points:[{x:25,y:25}]}],segmentDirections:{main:['forward'],B1:['reverse']},width:1.5,cap:'butt'},
   {id:'BT02',kind:'BT',x:24,y:19.25,w:2,h:1.5,angle:270,flowDirection:'forward',conveyorId:'CV01',offset:0}
  ];
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1540,height:1050}});
   await context.addInitScript(value=>{const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';localStorage.setItem(key,JSON.stringify(value));localStorage.removeItem(key+':tabs-v1');},plan);
   const page=await context.newPage();await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();await page.locator('.fp-editor').waitFor();
   await page.locator('.fp-list [data-select=BT02]').click();
   assert.equal(await page.locator('.fp-issues button').count(),0,'aligned legacy branch tunnel is accepted');
   assert.equal(await page.locator('[data-field=conveyorId]').inputValue(),'CV01');
   const fill=page.locator('[data-id=BT02] .fp-object-fill');
   assert.equal(await fill.count(),1,'legacy tunnel remains on the drawing');
   await page.reload();await page.locator('.fp-editor').waitFor();
   assert.equal(await page.locator('.fp-issues button').count(),0,'legacy tunnel remains valid after reload');
   console.log(`${editor?'Editor':'Viewer'}: aligned legacy branch BT02 has no stale warning`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
