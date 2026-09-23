const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const fs=require('fs');
const M=require('../js/floor-plan-model.js');
const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';
const tabsKey=key+':tabs-v1';

async function storedPlan(page){
 return page.evaluate(tabsKey=>{const workspace=JSON.parse(localStorage.getItem(tabsKey));return workspace.documents.find(document=>document.id===workspace.activeId).plan;},tabsKey);
}
async function clickSegment(page,branch,index){
 const target=page.locator('[data-segment-hit="'+index+'"][data-segment-branch="'+branch+'"]'),box=await target.boundingBox();
 assert.ok(box,'segment hit target is visible');
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
}

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.sample(),shuttle=plan.objects.find(object=>object.kind==='ST');
  shuttle.points=[{x:2,y:7},{x:10,y:7},{x:19.5,y:7}];
  shuttle.segmentDirections={main:['forward','forward']};
  shuttle.branches=[{id:'B1',from:0,points:[{x:2,y:11},{x:8,y:11}]}];
  plan.objects.push({id:'BT01',kind:'BT',x:20,y:18,w:6,h:2,angle:0,conveyorId:'CV01',offset:5,flowDirection:'forward',locked:false});
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1540,height:1080}});
   await context.addInitScript(({key,tabsKey,plan})=>{localStorage.setItem(key,JSON.stringify(plan));localStorage.removeItem(tabsKey);},{key,tabsKey,plan});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();
   await page.locator('.fp-editor').waitFor();

   for(const kind of ['T','ST','CV']){
    const id=plan.objects.find(object=>object.kind===kind).id;
    const object=page.locator('[data-map] [data-id="'+id+'"]');
    assert.ok(await object.locator('.fp-flow-marker').count()>0,kind+' replaces its dotted centerline with direction marks');
    assert.equal(await object.locator('[data-path-line]').count(),0,kind+' dotted centerline is removed');
   }
   assert.ok(await page.locator('[data-map] [data-id=ST01] .fp-flow-marker[data-flow-line=B1]').count()>0,'branch path inherits visible direction marks');
   assert.ok(await page.locator('[data-map] [data-id=BT01] .fp-flow-marker[data-flow-line=tunnel]').count()>0,'scan tunnel shows pallet flow marks');

   await page.locator('.fp-list [data-select=ST01]').click();
   assert.equal(await page.locator('.fp-flow-direction>.fp-muted').textContent(),'선택 구간 진행 방향');
   assert.equal(await page.locator('.fp-flow-direction-buttons [data-flow-direction=forward]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-flow-toggle]').count(),0,'drawing direction toggle is removed');
   await page.locator('.fp-flow-direction-buttons [data-flow-direction=reverse]').click();
   let stored=(await storedPlan(page)).objects.find(object=>object.id==='ST01');
   assert.deepEqual(stored.segmentDirections.main,['reverse','forward'],'only the selected main segment changes');
   assert.ok(await page.locator('[data-map] [data-id=ST01] .fp-flow-marker[data-flow-line=main][data-flow-segment="0"][data-flow-direction=reverse]').count()>0);
   assert.ok(await page.locator('[data-map] [data-id=ST01] .fp-flow-marker[data-flow-line=main][data-flow-segment="1"][data-flow-direction=forward]').count()>0);

   await clickSegment(page,-1,1);
   assert.equal(await page.locator('.fp-flow-direction-buttons [data-flow-direction=forward]').getAttribute('aria-pressed'),'true','second segment keeps its own direction');
   await page.locator('.fp-flow-direction-buttons [data-flow-direction=reverse]').click();
   stored=(await storedPlan(page)).objects.find(object=>object.id==='ST01');
   assert.deepEqual(stored.segmentDirections.main,['reverse','reverse']);
   await clickSegment(page,0,0);
   await page.locator('.fp-flow-direction-buttons [data-flow-direction=reverse]').click();
   stored=(await storedPlan(page)).objects.find(object=>object.id==='ST01');
   assert.deepEqual(stored.segmentDirections.B1,['reverse','forward'],'branch segments keep independent directions');

   await clickSegment(page,-1,1);
   await page.locator('[data-action=addNode]').click();
   stored=(await storedPlan(page)).objects.find(object=>object.id==='ST01');
   assert.deepEqual(stored.segmentDirections.main,['reverse','reverse','reverse'],'split segments inherit the original direction');
   assert.equal(await page.locator('.fp-flow-direction').count(),0,'point selection hides segment direction controls');
   await page.locator('[data-action=deleteNode]').click();
   stored=(await storedPlan(page)).objects.find(object=>object.id==='ST01');
   assert.deepEqual(stored.segmentDirections.main,['reverse','reverse'],'merged segment keeps the preceding direction');

   await page.locator('.fp-list [data-select=BT01]').click();
   assert.equal(await page.locator('.fp-prop-top h3').textContent(),'스캔 터널 정보');
   assert.equal(await page.locator('.fp-flow-direction>.fp-muted').textContent(),'팔레트 진행 방향');
   await page.locator('.fp-flow-direction-buttons [data-flow-direction=reverse]').click();
   assert.equal((await storedPlan(page)).objects.find(object=>object.id==='BT01').flowDirection,'reverse','inspector reverses the scan tunnel');
   await page.locator('[data-action=undo]').click();
   assert.equal((await storedPlan(page)).objects.find(object=>object.id==='BT01').flowDirection,'forward','flow direction participates in undo');
   if(editor){fs.mkdirSync('output/floor-plan-flow-direction',{recursive:true});await page.screenshot({path:'output/floor-plan-flow-direction/editor.png',fullPage:true});}

   await page.evaluate(()=>{window.showSaveFilePicker=undefined;});
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action=export]').click()]);
   const saved=M.readFile(JSON.parse(fs.readFileSync(await download.path())));
   assert.deepEqual(saved.objects.find(object=>object.id==='ST01').segmentDirections.main,['reverse','reverse']);
   assert.deepEqual(saved.objects.find(object=>object.id==='ST01').segmentDirections.B1,['reverse','forward']);
   assert.equal(saved.objects.find(object=>object.id==='BT01').flowDirection,'forward');
   console.log((editor?'Editor':'Viewer')+': PASS independent main/branch segment directions, point split/merge inheritance, panel-only BT direction, undo and .gics roundtrip');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
