const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const fs=require('fs');
const M=require('../js/floor-plan-model.js');

const expected={W:'#cddff5',T:'#b9e3d4',GR:'#f4aeba',CV:'#efd3a4',BT:'#dbc3ef',B:'#dce3ed',D:'#dce3ed',S:'#dce3ed'};
const source={W:'#9bbfeb',T:'#73c7a9',GR:'#e85d75',CV:'#dfa749',BT:'#b787df',B:'#b9c7db',D:'#b9c7db',S:'#b9c7db'};
const rgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
const baseUrl=process.env.PLANDY_TEST_URL||'http://127.0.0.1:4173';

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  assert.ok(Object.entries(source).every(([kind,color])=>kind==='GR'||color!==source.GR),'GR uses a color distinct from every other placement tool');
  const plan=M.sample();
  plan.objects.push({id:'BT01',kind:'BT',x:20,y:18,w:6,h:2,angle:0,conveyorId:'CV01',offset:5,flowDirection:'forward',locked:false});
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1540,height:1080}});
   await context.addInitScript(plan=>{const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';localStorage.setItem(key,JSON.stringify(plan));localStorage.removeItem(key+':tabs-v1');},plan);
   const page=await context.newPage();
   await page.goto(baseUrl+'/#custom-1789604650974');
   await page.waitForTimeout(1000);
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();
   await page.locator('.fp-editor').waitFor();
   assert.equal((await page.locator('pattern path').getAttribute('stroke')).toLowerCase(),'#c5ced8','Grid uses the requested line color');
   assert.match(await page.locator('[data-map]>rect').nth(1).getAttribute('fill'),/^url\(#fp-grid-/,'Grid pattern is rendered behind objects');
   for(const kind of Object.keys(expected)){
    const fill=page.locator('[data-map] .fp-map-object[data-kind="'+kind+'"] .fp-object-fill').first();
    assert.equal(await fill.evaluate(element=>getComputedStyle(element).opacity),'0.5',kind+' fill is 50% translucent');
    const polygon=['T','GR','CV'].includes(kind)?fill.locator('polygon').first():fill;
    assert.equal(await polygon.getAttribute('fill'),source[kind],kind+' uses compensated source color');
    const actual=rgb(source[kind]).map(value=>Math.round(value*.5+255*.5));
    assert.ok(actual.every((value,index)=>Math.abs(value-rgb(expected[kind])[index])<=1),kind+' visible color matches the expected translucent color');
   }
   const initialSizes={};
   for(const kind of ['B','S','D']){
    const initial=page.locator('[data-map] .fp-map-object[data-kind="'+kind+'"] .fp-object-initial').first();
    assert.equal(await initial.textContent(),kind,kind+' shows its initial');
    const appearance=await initial.evaluate(element=>{const shape=element.parentElement.querySelector('.fp-object-fill').getBBox(),style=getComputedStyle(element),canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font=style.font;context.textAlign='center';const ink=context.measureText(element.textContent),x=Number(element.getAttribute('x')),y=Number(element.getAttribute('y'));return{shape:{x:shape.x,y:shape.y,w:shape.width,h:shape.height},inkWidth:ink.actualBoundingBoxLeft+ink.actualBoundingBoxRight,inkHeight:ink.actualBoundingBoxAscent+ink.actualBoundingBoxDescent,inkCenterX:x+(ink.actualBoundingBoxRight-ink.actualBoundingBoxLeft)/2,inkCenterY:y+(ink.actualBoundingBoxDescent-ink.actualBoundingBoxAscent)/2,baseline:element.getAttribute('dominant-baseline'),opacity:style.fillOpacity,pointerEvents:style.pointerEvents,fontSize:parseFloat(style.fontSize)};});
    assert.equal(appearance.opacity,'0.3',kind+' initial is 70% transparent');
    assert.equal(appearance.pointerEvents,'none',kind+' initial does not block selection');
    assert.equal(appearance.baseline,'alphabetic',kind+' uses glyph-based vertical alignment');
    assert.ok(appearance.inkWidth<=appearance.shape.w+2&&Math.abs(appearance.inkCenterX-(appearance.shape.x+appearance.shape.w/2))<1,kind+' initial fits horizontally');
    assert.ok(appearance.inkHeight<=appearance.shape.h+2&&Math.abs(appearance.inkCenterY-(appearance.shape.y+appearance.shape.h/2))<1,kind+' initial fits vertically');
    initialSizes[kind]=appearance.fontSize;
   }
   assert.ok(initialSizes.B>initialSizes.D&&initialSizes.D>initialSizes.S,'initial size follows shape dimensions');
   const initialBox=await page.locator('[data-map] .fp-map-object[data-kind=B] .fp-object-initial').first().boundingBox();
   await page.mouse.click(initialBox.x+initialBox.width/2,initialBox.y+initialBox.height/2);
   assert.equal(await page.locator('[data-map] .fp-map-object[data-kind=B]').first().getAttribute('data-selected'),'true','clicking the initial selects its shape');
   await page.locator('[data-action=objectClockwise]').click();
   assert.match(await page.locator('[data-map] .fp-map-object[data-kind=B] .fp-object-initial').first().getAttribute('transform'),/^rotate\(90 /,'initial follows object rotation');
   assert.equal(await page.locator('[data-map] .fp-map-object[data-kind="W"] .fp-cells rect').first().getAttribute('fill-opacity'),'.5','rack cells use the same 50% opacity');
   if(editor){fs.mkdirSync('output/floor-plan-transparency',{recursive:true});await page.screenshot({path:'output/floor-plan-transparency/editor.png',fullPage:true});}
   console.log((editor?'Editor':'Viewer')+': PASS translucent placement tools, visible Grid and compensated colors');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
