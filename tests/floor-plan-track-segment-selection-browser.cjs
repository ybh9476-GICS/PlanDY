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
   const track=plan.objects.find(o=>o.id===id);
   track.points=[{x:2,y:3},{x:6,y:5},{x:10,y:9}];
   track.segmentDirections={main:['forward','forward']};
  }
  const shuttle=plan.objects.find(o=>o.id==='ST01');
  shuttle.branches=[{id:'B1',from:1,points:[{x:2,y:12},{x:3,y:16}]}];
  shuttle.segmentDirections.B1=['forward','forward'];
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
    assert.equal(await page.locator('.fp-handle + text').count(),0,id+' point numbers are hidden');
    const line=page.locator('[data-segment-hit="1"][data-segment-branch="-1"]');
    await page.mouse.click(...Object.values(await centerOf(line)));
    assert.equal(await page.locator('[data-field=segment]').count(),0,id+' segment dropdown is removed');
    assert.equal(await page.locator('[data-field=direction]').count(),0,id+' segment direction field is removed');
    assert.equal(await line.getAttribute('class'),'fp-segment-hit is-selected',id+' selected segment highlighted');
    assert.notEqual(await line.evaluate(el=>getComputedStyle(el).stroke),'rgba(0, 0, 0, 0)',id+' selected segment has a visible stroke');
    const source=plan.objects.find(o=>o.id===id),a=source.points[1],b=source.points[2],expected=Number(Math.hypot(b.x-a.x,b.y-a.y).toFixed(2));
    assert.equal(Number(await page.locator('[data-field=length]').inputValue()),expected,id+' selected segment length is the only segment value shown');
    if(editor&&id==='T01'){
     const oldAngle=Math.atan2(b.y-a.y,b.x-a.x),nextLength=M.round(expected+1.25);
     await page.locator('[data-field=length]').fill(String(nextLength));
     await page.locator('[data-field=length]').press('Enter');
     const updatedLine=page.locator('[data-segment-hit="1"][data-segment-branch="-1"]');
     const geometry=await updatedLine.evaluate(el=>({x1:Number(el.getAttribute('x1')),y1:Number(el.getAttribute('y1')),x2:Number(el.getAttribute('x2')),y2:Number(el.getAttribute('y2'))}));
     const scale=Number(await page.locator('[data-floor]').getAttribute('width'))/plan.width;
     assert.ok(Math.abs(Math.hypot(geometry.x2-geometry.x1,geometry.y2-geometry.y1)/scale-nextLength)<0.02,'length edit changes the selected segment length');
     assert.ok(Math.abs(Math.atan2(geometry.y2-geometry.y1,geometry.x2-geometry.x1)-oldAngle)<0.002,'length edit preserves the selected segment angle');
    }
   }
   await page.locator('.fp-list [data-select=ST01]').click();
   const branchLine=page.locator('[data-segment-hit="1"][data-segment-branch="0"]');
   await page.mouse.click(...Object.values(await centerOf(branchLine)));
    assert.equal(await branchLine.getAttribute('class'),'fp-segment-hit is-selected','branch segment selects its branch');
    assert.equal(await page.locator('[data-branch-select],[data-node]').count(),0,'inspector branch and point selector lists stay removed');
   assert.equal(await page.locator('[data-field=segment]').count(),0,'branch segment dropdown is absent');
   assert.equal(Number(await page.locator('[data-field=length]').inputValue()),Number(Math.hypot(1,4).toFixed(2)),'branch segment length is shown');
   const point=page.locator('[data-node-handle="2"][data-branch-handle="0"]');
   const pointBox=await point.boundingBox();
   await page.mouse.click(pointBox.x+pointBox.width/2,pointBox.y+pointBox.height/2);
    assert.equal(await point.getAttribute('fill'),'#245ac6','point selection still wins over segment hit area');
   assert.equal(await page.locator('[data-field=length]').count(),0,'point selection hides segment length');
   assert.equal(await page.locator('[data-field=x],[data-field=y]').count(),2,'point selection shows point coordinates');
   assert.equal(await page.locator('.fp-handle + text').count(),0,'selected branch point numbers stay hidden');
   const mainLine=page.locator('[data-segment-hit="1"][data-segment-branch="-1"]');
   const start=await centerOf(mainLine);
    await page.mouse.click(start.x,start.y);
    assert.equal(await mainLine.getAttribute('class'),'fp-segment-hit is-selected','main segment selection switches back from the branch on canvas');
    await page.mouse.click(start.x,start.y);
    assert.equal(await mainLine.getAttribute('class'),'fp-segment-hit is-selected','main segment selection switches back from the branch on canvas');
   await page.mouse.move(start.x,start.y);
   await page.mouse.down();
   await page.mouse.move(start.x+45,start.y+25,{steps:5});
   await page.mouse.up();
   const moved=await centerOf(page.locator('[data-segment-hit="1"][data-segment-branch="-1"]'));
   assert.ok(Math.hypot(moved.x-start.x,moved.y-start.y)>10,'dragging a selected segment still moves the entire track');
   console.log((editor?'editor':'viewer')+': PASS segment canvas selection, length-only inspector, hidden point numbers, point priority and track drag');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
