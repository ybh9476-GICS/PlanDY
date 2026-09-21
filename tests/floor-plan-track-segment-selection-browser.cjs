const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const M=require('../js/floor-plan-model.js');
const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';
function centerOf(line){
 return line.evaluate(el=>{
  const box=el.ownerSVGElement.getBoundingClientRect();
  return{x:box.x+(Number(el.getAttribute('x1'))+Number(el.getAttribute('x2')))/2,y:box.y+(Number(el.getAttribute('y1'))+Number(el.getAttribute('y2')))/2};
 });
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.sample();
  for(const id of ['T01','ST01','CV01']){
   const track=plan.objects.find(o=>o.id===id),a=track.points[0],c=track.points[1],b={x:M.round((a.x+c.x)/2),y:M.round((a.y+c.y)/2)};
   track.points=[a,b,c];
  }
  const shuttle=plan.objects.find(o=>o.id==='ST01');
  shuttle.branches=[{id:'B1',from:1,points:[{x:10,y:11},{x:14,y:13}]}];
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1540,height:1050}});
   await context.addInitScript(({key,plan})=>localStorage.setItem(key,JSON.stringify(plan)),{key,plan});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();
   await page.locator('.fp-editor').waitFor();
   for(const id of ['T01','ST01','CV01']){
    await page.locator('.fp-list [data-select="'+id+'"]').click();
    const line=page.locator('[data-segment-hit="1"][data-segment-branch="-1"]');
    await page.mouse.click(...Object.values(await centerOf(line)));
    assert.equal(await page.locator('[data-field=segment]').inputValue(),'main:1',id+' second segment selected');
    assert.equal(await line.getAttribute('class'),'fp-segment-hit is-selected',id+' selected segment highlighted');
    assert.notEqual(await line.evaluate(el=>getComputedStyle(el).stroke),'rgba(0, 0, 0, 0)',id+' selected segment has a visible stroke');
    const source=plan.objects.find(o=>o.id===id),a=source.points[1],b=source.points[2];
    assert.equal(Number(await page.locator('[data-field=length]').inputValue()),M.round(Math.hypot(b.x-a.x,b.y-a.y)),id+' selected segment length is shown');
    assert.equal(Number(await page.locator('[data-field=direction]').inputValue()),M.round(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI),id+' selected segment direction is shown');
   }
   await page.locator('.fp-list [data-select=ST01]').click();
   const branchLine=page.locator('[data-segment-hit="1"][data-segment-branch="0"]');
   await page.mouse.click(...Object.values(await centerOf(branchLine)));
   assert.equal(await page.locator('[data-branch-select="0"]').getAttribute('aria-pressed'),'true','branch segment selects its branch');
   assert.equal(await page.locator('[data-field=segment]').inputValue(),'B1:1','branch segment index selected');
   const point=page.locator('[data-node-handle="2"][data-branch-handle="0"]');
   const pointBox=await point.boundingBox();
   await page.mouse.click(pointBox.x+pointBox.width/2,pointBox.y+pointBox.height/2);
   assert.deepEqual(await page.locator('[data-node][aria-pressed=true]').allTextContents(),['2-2'],'point selection still wins over segment hit area');
   await page.locator('[data-branch-select="-1"]').click();
   const mainLine=page.locator('[data-segment-hit="1"][data-segment-branch="-1"]');
   const start=await centerOf(mainLine);
   await page.mouse.move(start.x,start.y);
   await page.mouse.down();
   await page.mouse.move(start.x+45,start.y+25,{steps:5});
   await page.mouse.up();
   const moved=await centerOf(page.locator('[data-segment-hit="1"][data-segment-branch="-1"]'));
   assert.ok(Math.hypot(moved.x-start.x,moved.y-start.y)>10,'dragging a selected segment still moves the entire track');
   console.log((editor?'editor':'viewer')+': PASS T/ST/CV main and branch segment selection, highlight, point priority, track drag');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});