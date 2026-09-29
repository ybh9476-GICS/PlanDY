const { chromium } = require(process.env.PLANDY_PLAYWRIGHT);
const assert = require('assert/strict');
const M = require('../js/floor-plan-model.js');

async function clickPoint(page, branch, index) {
  let target = page.locator('[data-point-hit="' + index + '"][data-point-branch="' + branch + '"]');
  let box = await target.count() ? await target.boundingBox() : null;
  if (!box) {
    const line = page.locator('[data-segment-hit="0"][data-segment-branch="' + branch + '"]');
    const center = await line.evaluate(el => {
      const svg = el.ownerSVGElement.getBoundingClientRect();
      return { x: svg.x + (Number(el.getAttribute('x1')) + Number(el.getAttribute('x2'))) / 2, y: svg.y + (Number(el.getAttribute('y1')) + Number(el.getAttribute('y2'))) / 2 };
    });
    await page.mouse.click(center.x, center.y);
    target = page.locator('[data-node-handle="' + index + '"][data-branch-handle="' + branch + '"]');
    box = await target.boundingBox();
  }
  assert.ok(box, 'path point hit target is visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.sample(),track=plan.objects.find(o=>o.id==='GR01');
  track.points=[{x:2,y:7},{x:10,y:7},{x:19.5,y:7}];
  track.branches=[
   {id:'B1',from:1,points:[{x:16,y:10},{x:14,y:14}]},
   {id:'B2',parent:'B1',from:2,points:[{x:19,y:16}]}
  ];
  delete track.segmentDirections;
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1540,height:1050}});
   await context.addInitScript(({key,plan})=>localStorage.setItem(key,JSON.stringify(plan)),{key:'wms-floor-plan-editor-draft-v2:custom-1789604650974',plan});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();
   await page.locator('.fp-editor').waitFor();
   await page.locator('.fp-list [data-select=GR01]').click();
   assert.equal(await page.locator('[data-branch-select],[data-node]').count(),0,'inspector selector lists are removed');
   const branchSegment=page.locator('[data-segment-hit="0"][data-segment-branch="0"]');
   const [x1,y1,x2,y2]=await branchSegment.evaluate(el=>['x1','y1','x2','y2'].map(name=>Number(el.getAttribute(name))));
   const svgBox=await page.locator('.fp-canvas').boundingBox();
   await page.mouse.click(svgBox.x+(x1+x2)/2,svgBox.y+(y1+y2)/2);
   const sourceHandle=page.locator('[data-node-handle="0"][data-branch-handle="0"]'),sourceBox=await sourceHandle.boundingBox();
   await page.mouse.click(sourceBox.x+sourceBox.width/2,sourceBox.y+sourceBox.height/2);
   assert.equal(await page.locator('[data-action=deleteNode]').isEnabled(),true,(editor?'editor':'viewer')+' resolves a branch source handle to its deletable parent point');
   await page.locator('[data-action=deleteNode]').click();
   assert.equal(await page.locator('[data-segment-branch="0"]').count(),0,'deleting the resolved junction removes its dependent branch tree');
   await page.locator('[data-action=undo]').click();
   assert.ok(await page.locator('[data-segment-branch="0"]').count()>0,'undo restores the deleted junction and its branch tree');
   await clickPoint(page,0,2);
   const handle=page.locator('[data-node-handle="2"][data-branch-handle="0"]');
   assert.equal(await handle.getAttribute('fill'),'#245ac6','direct canvas click selects the owning branch point');
   const box=await handle.boundingBox(),center={x:box.x+box.width/2,y:box.y+box.height/2};
   await page.mouse.move(center.x,center.y);
   await page.mouse.down();
   await page.mouse.move(center.x+36,center.y-24,{steps:4});
   await page.mouse.up();
   const movedBox=await page.locator('[data-node-handle="2"][data-branch-handle="0"]').boundingBox();
   const moved={x:movedBox.x+movedBox.width/2,y:movedBox.y+movedBox.height/2};
   assert.ok(Math.abs(moved.x-center.x)>10||Math.abs(moved.y-center.y)>10,'selected branch point moves by drag');
   const childLine=page.locator('[data-segment-hit="0"][data-segment-branch="1"]');
   const childCenter=await childLine.evaluate(el=>{const svg=el.ownerSVGElement.getBoundingClientRect();return{x:svg.x+(Number(el.getAttribute('x1'))+Number(el.getAttribute('x2')))/2,y:svg.y+(Number(el.getAttribute('y1'))+Number(el.getAttribute('y2')))/2};});
   await page.mouse.click(childCenter.x,childCenter.y);
   const childSourceBox=await page.locator('[data-node-handle="0"][data-branch-handle="1"]').boundingBox();
   const childSource={x:childSourceBox.x+childSourceBox.width/2,y:childSourceBox.y+childSourceBox.height/2};
   assert.ok(Math.abs(childSource.x-moved.x)<1&&Math.abs(childSource.y-moved.y)<1,'child branch follows the moved junction');
   console.log((editor?'editor':'viewer')+': PASS direct canvas branch-point selection and shared-junction drag');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
