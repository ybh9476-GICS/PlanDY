const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const M=require('../js/floor-plan-model.js');

async function mapPoint(page,x,y){return page.locator('[data-floor]').evaluate((el,{x,y})=>{const box=el.ownerSVGElement.getBoundingClientRect(),scale=Number(el.getAttribute('width'))/50;return{x:box.x+Number(el.getAttribute('x'))+x*scale,y:box.y+Number(el.getAttribute('y'))+y*scale};},{x,y});}
async function tunnelCenter(page){return page.locator('[data-id=BT01] .fp-object-fill').evaluate(el=>{const polygon=el.tagName.toLowerCase()==='polygon'?el:el.querySelector('polygon'),points=polygon.getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number)),svg=el.ownerSVGElement.getBoundingClientRect();return{x:svg.x+points.reduce((sum,p)=>sum+p[0],0)/points.length,y:svg.y+points.reduce((sum,p)=>sum+p[1],0)/points.length};});}

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.blank();plan.width=50;plan.height=50;
  plan.objects=[{id:'CV01',kind:'CV',points:[{x:5,y:10},{x:25,y:10}],branches:[{id:'B1',from:1,points:[{x:25,y:25},{x:35,y:25}]}],width:1.5,cap:'butt',locked:false},{id:'CV02',kind:'CV',points:[{x:5,y:35},{x:25,y:35}],width:1.5,cap:'butt',locked:false}];
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1540,height:1050}});
   await context.addInitScript(plan=>{const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';localStorage.setItem(key,JSON.stringify(plan));localStorage.removeItem(key+':tabs-v1');},plan);
   const page=await context.newPage();await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();await page.locator('.fp-editor').waitFor();
   await page.locator('[data-tool=BT]').click();
   let target=await mapPoint(page,25,20);await page.mouse.move(target.x,target.y);
   assert.equal(await page.locator('.fp-tunnel-target').count(),1,'the branch target is highlighted before placement');
   await page.mouse.click(target.x,target.y);
   assert.equal(await page.locator('[data-id=BT01]').count(),1,'clicking CV branch creates a tunnel');
   assert.equal(await page.locator('[data-field=conveyorId]').inputValue(),'CV01','branch click assigns its conveyor');
   assert.equal(await page.locator('[data-field=offset]').count(),0,'distance field is removed');
   assert.equal(await page.locator('.fp-issues button').count(),0,'branch placement has no false warnings');
   let center=await tunnelCenter(page);assert.ok(Math.hypot(center.x-target.x,center.y-target.y)<2,'tunnel snaps onto clicked branch');

   await page.locator('[data-field=conveyorId]').selectOption('CV02');
   assert.equal(await page.locator('[data-field=conveyorId]').inputValue(),'CV02','dropdown reassigns conveyor');
   assert.equal(await page.locator('.fp-issues button').count(),0,'dropdown reassignment is aligned');
   center=await tunnelCenter(page);target=await mapPoint(page,24,35);
   assert.ok(Math.hypot(center.x-target.x,center.y-target.y)<2,'dropdown snaps to nearest valid section');

   await page.mouse.move(center.x,center.y);await page.mouse.down();
   target=await mapPoint(page,15,10);await page.mouse.move(target.x,target.y,{steps:5});await page.mouse.up();
   assert.equal(await page.locator('[data-field=conveyorId]').inputValue(),'CV01','dragging onto another conveyor reassigns it');
   assert.equal(await page.locator('.fp-issues button').count(),0,'dragged tunnel stays aligned');
   center=await tunnelCenter(page);assert.ok(Math.hypot(center.x-target.x,center.y-target.y)<2,'drop snaps to the target section');
   await page.locator('.fp-list [data-select=CV01]').click();
   await page.locator('[data-field=id]').fill('CV03');
   await page.locator('[data-field=id]').press('Enter');
   await page.locator('.fp-list [data-select=BT01]').click();
   assert.equal(await page.locator('[data-field=conveyorId]').inputValue(),'CV03','renaming a conveyor preserves the tunnel link');
   assert.equal(await page.locator('.fp-issues button').count(),0,'renamed conveyor still validates');
   const beforeEdit=await tunnelCenter(page);
   await page.locator('.fp-list [data-select=CV03]').click();
   const handle=await page.locator('[data-node-handle="1"][data-branch-handle="-1"]').boundingBox();
   const start={x:handle.x+handle.width/2,y:handle.y+handle.height/2},shift=await mapPoint(page,0,2),origin=await mapPoint(page,0,0);
   await page.mouse.move(start.x,start.y);await page.mouse.down();
   await page.mouse.move(start.x,start.y+shift.y-origin.y,{steps:5});await page.mouse.up();
   const afterEdit=await tunnelCenter(page);
   assert.ok(Math.hypot(afterEdit.x-beforeEdit.x,afterEdit.y-beforeEdit.y)>5,'tunnel follows an edited conveyor segment');
   assert.equal(await page.locator('.fp-issues button').count(),0,'following an edited conveyor remains valid');
   console.log(`${editor?'Editor':'Viewer'}: branch click, dropdown reassignment, drag-and-drop PASS`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
