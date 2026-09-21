const { chromium } = require(process.env.PLANDY_PLAYWRIGHT);
const assert = require('assert/strict');
const M = require('../js/floor-plan-model.js');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.sample(),track=plan.objects.find(o=>o.id==='ST01');
  track.branches=[
   {id:'B1',from:1,points:[{x:16,y:10},{x:14,y:14}]},
   {id:'B2',parent:'B1',from:2,points:[{x:19,y:16}]}
  ];
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1540,height:1050}});
   await context.addInitScript(({key,plan})=>localStorage.setItem(key,JSON.stringify(plan)),{key:'wms-floor-plan-editor-draft-v2:custom-1789604650974',plan});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();
   await page.locator('.fp-editor').waitFor();
   await page.locator('.fp-list [data-select=ST01]').click();
   await page.locator('[data-branch-select="0"]').click();
   await page.locator('[data-node="2"]').click();
   const handle=page.locator('[data-node-handle="2"][data-branch-handle="0"]');
   const box=await handle.boundingBox(),center={x:box.x+box.width/2,y:box.y+box.height/2};
   await page.locator('[data-branch-select="-1"]').click();
   const before=await page.locator('[data-branch-select="0"]').getAttribute('aria-pressed');
   await page.mouse.click(center.x,center.y);
   const after=await page.locator('[data-branch-select="0"]').getAttribute('aria-pressed');
   const selectedNode=await page.locator('[data-node][aria-pressed=true]').allTextContents();
   console.log((editor?'editor':'viewer')+': branchBefore='+before+', branchAfter='+after+', selectedNode='+JSON.stringify(selectedNode));
   assert.equal(before,'false');
   assert.equal(after,'true','direct click selects the owning branch');
   assert.deepEqual(selectedNode,['2-2'],'the hierarchical point number stays selected');
   await page.mouse.move(center.x,center.y);
   await page.mouse.down();
   await page.mouse.move(center.x+36,center.y-24,{steps:4});
   await page.mouse.up();
   const movedBox=await page.locator('[data-node-handle="2"][data-branch-handle="0"]').boundingBox();
   const moved={x:movedBox.x+movedBox.width/2,y:movedBox.y+movedBox.height/2};
   assert.ok(Math.abs(moved.x-center.x)>10||Math.abs(moved.y-center.y)>10,'selected branch point moves by drag');
   await page.locator('[data-branch-select="1"]').click();
   const childSourceBox=await page.locator('[data-node-handle="0"][data-branch-handle="1"]').boundingBox();
   const childSource={x:childSourceBox.x+childSourceBox.width/2,y:childSourceBox.y+childSourceBox.height/2};
   assert.ok(Math.abs(childSource.x-moved.x)<1&&Math.abs(childSource.y-moved.y)<1,'child branch follows the moved junction');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
