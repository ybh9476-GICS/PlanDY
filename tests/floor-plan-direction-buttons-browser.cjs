const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const fs=require('fs');
const M=require('../js/floor-plan-model.js');
const beforeMode=process.argv.includes('--before');
const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';
const tabsKey=key+':tabs-v1';

async function readPlan(page){
 return page.evaluate(tabsKey=>{const data=JSON.parse(localStorage.getItem(tabsKey));return data.documents.find(item=>item.id===data.activeId).plan;},tabsKey);
}
function center(object){const b=M.bounds(object);return{x:M.round(b.x+b.w/2),y:M.round(b.y+b.h/2)};}

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.sample();
  if(!plan.objects.some(o=>o.kind==='BT'))plan.objects.push({id:'BT01',kind:'BT',x:20,y:20,w:2,h:1.5,angle:0,conveyorId:'CV01',offset:5,locked:false});
  const shuttle=plan.objects.find(o=>o.kind==='ST');
  shuttle.branches=[{id:'B1',from:0,points:[{x:shuttle.points[0].x,y:shuttle.points[0].y+3}]}];
  for(const object of plan.objects.filter(o=>o.kind!=='W'))M.move(object,15,12,'center');
  const ids=Object.fromEntries(['W','T','ST','CV','BT','B','D','S'].map(kind=>[kind,plan.objects.find(o=>o.kind===kind).id]));
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1540,height:1100}});
   await context.addInitScript(({key,tabsKey,plan})=>{localStorage.setItem(key,JSON.stringify(plan));localStorage.removeItem(tabsKey);},{key,tabsKey,plan});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
   await page.waitForTimeout(1000);
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();
   await page.locator('.fp-editor').waitFor();

   await page.locator('.fp-list [data-select="'+ids.W+'"]').click();
   assert.equal(await page.locator('.fp-object-rotation').count(),0,'rack excludes common direction controls');
   assert.equal(await page.locator('[data-action=rackClockwise],[data-action=rackCounterclockwise]').count(),2,'rack keeps its own controls');

   if(beforeMode){
    for(const kind of ['T','ST','CV','BT','B','D','S']){
     await page.locator('.fp-list [data-select="'+ids[kind]+'"]').click();
     assert.equal(await page.locator('[data-action=objectClockwise],[data-action=objectCounterclockwise]').count(),0,kind+' lacks common direction controls before change');
    }
    console.log((editor?'Editor':'Viewer')+': REPRODUCED missing common direction buttons for T/ST/CV/BT/B/D/S');
    await context.close();
    continue;
   }

   for(const kind of ['T','ST','CV','BT','B','D','S']){
    const id=ids[kind];
    await page.locator('.fp-list [data-select="'+id+'"]').click();
    const clockwise=page.locator('[data-action=objectClockwise]'),counter=page.locator('[data-action=objectCounterclockwise]');
    assert.equal(await clockwise.count(),1,kind+' clockwise button');
    assert.equal(await counter.count(),1,kind+' counterclockwise button');
    assert.equal(await clockwise.textContent(),'↻ 시계 90°');
    assert.equal(await counter.textContent(),'↺ 반시계 90°');
    const original=(await readPlan(page)).objects.find(o=>o.id===id),originalCenter=center(original);
    await clockwise.click();
    const rotated=(await readPlan(page)).objects.find(o=>o.id===id);
    assert.deepEqual(center(rotated),originalCenter,kind+' keeps its center while rotating clockwise');
    if(rotated.points){
     assert.notDeepEqual(rotated.points,original.points,kind+' rotates every main path point');
     if(original.branches?.length)assert.notDeepEqual(rotated.branches,original.branches,kind+' rotates every branch point');
    }
    else assert.equal(rotated.angle,((original.angle||0)+90)%360,kind+' angle increases by 90 degrees');
    await counter.click();
    const restored=(await readPlan(page)).objects.find(o=>o.id===id);
    assert.deepEqual(restored,original,kind+' returns exactly after opposite rotations');
   }

   await page.locator('.fp-list [data-select="'+ids.T+'"]').click();
   await page.locator('[data-action=objectCounterclockwise]').click();
   await page.evaluate(()=>{window.showSaveFilePicker=undefined;});
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action=export]').click()]);
   const saved=M.readFile(JSON.parse(fs.readFileSync(await download.path())));
   assert.deepEqual(saved.objects.find(o=>o.id===ids.T),(await readPlan(page)).objects.find(o=>o.id===ids.T),'rotated path survives .gics roundtrip');
   console.log((editor?'Editor':'Viewer')+': PASS two-way direction buttons, center preservation, exact reverse rotation and .gics roundtrip for all non-rack tools');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
