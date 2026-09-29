const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const M=require('../js/floor-plan-model.js');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.sample();
  plan.width=50;plan.height=50;
  plan.objects=['T','GR','CV'].map((kind,i)=>({id:`${kind}01`,kind,points:[{x:5,y:8+i*10},{x:11,y:8+i*10},{x:23,y:8+i*10}],width:1,cap:'butt',locked:false}));
  plan.objects.find(o=>o.id==='GR01').branches=[{id:'B1',from:1,points:[{x:11,y:22},{x:15,y:22}]}];
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1540,height:1050}});
   await context.addInitScript(plan=>localStorage.setItem('wms-floor-plan-editor-draft-v2:custom-1789604650974',JSON.stringify(plan)),plan);
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();
   await page.locator('.fp-editor').waitFor();
   for(const kind of ['T','GR','CV']){
    await page.locator(`.fp-list [data-select="${kind==='T'?'CV':'T'}01"]`).click();
    const floor=await page.locator('[data-floor]').evaluate(el=>{
     const box=el.ownerSVGElement.getBoundingClientRect();
     return{x:box.x+Number(el.getAttribute('x')),y:box.y+Number(el.getAttribute('y')),scale:Number(el.getAttribute('width'))/50};
    });
    const y=8+['T','GR','CV'].indexOf(kind)*10;
    await page.mouse.click(floor.x+17*floor.scale,floor.y+y*floor.scale);
    assert.equal(await page.locator(`[data-id="${kind}01"]`).getAttribute('data-selected'),'true',`${kind} selected by canvas click`);
    assert.equal(await page.locator('[data-segment-hit].is-selected').getAttribute('data-segment-hit'),'1',`${kind} clicked second segment is selected`);
    assert.equal(await page.locator('[data-field=length]').inputValue(),'12.00',`${kind} inspector displays clicked segment length`);
   }
   await page.locator('.fp-list [data-select="T01"]').click();
   const floor=await page.locator('[data-floor]').evaluate(el=>{
    const box=el.ownerSVGElement.getBoundingClientRect();
    return{x:box.x+Number(el.getAttribute('x')),y:box.y+Number(el.getAttribute('y')),scale:Number(el.getAttribute('width'))/50};
   });
   await page.mouse.click(floor.x+13*floor.scale,floor.y+22*floor.scale);
   assert.equal(await page.locator('[data-id="GR01"]').getAttribute('data-selected'),'true','GR branch selected by canvas click');
   assert.equal(await page.locator('[data-segment-hit].is-selected').getAttribute('data-segment-branch'),'0','clicked branch selected');
   assert.equal(await page.locator('[data-segment-hit].is-selected').getAttribute('data-segment-hit'),'1','clicked second branch segment selected');
   assert.equal(await page.locator('[data-field=length]').inputValue(),'4.00','branch segment length displayed');
   console.log(`${editor?'Editor':'Viewer'}: T, GR, CV second segment selection PASS`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
