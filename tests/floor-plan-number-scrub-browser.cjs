const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const M=require('../js/floor-plan-model.js');
const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';

async function drag(page,handle,dx){
 const box=await handle.boundingBox();
 const x=box.x+box.width/2,y=box.y+box.height/2;
 await page.mouse.move(x,y);
 await page.mouse.down();
 if(dx)await page.mouse.move(x+dx,y,{steps:6});
 await page.mouse.up();
}

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const editor of [false,true]){
   const context=await browser.newContext({viewport:{width:1540,height:1050}});
   const plan=M.sample();
   await context.addInitScript(({key,plan})=>localStorage.setItem(key,JSON.stringify(plan)),{key,plan});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
   await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
   await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
   await page.locator('#loginSubmitBtn').click();
   await page.locator('.fp-editor').waitFor();
   await page.locator('.fp-list [data-select=W01]').click();

   const width=page.locator('[data-field=w]'),handle=width.locator('xpath=following-sibling::*[@data-number-scrub]');
   assert.equal(await handle.count(),1,'number input has one scrub area');
   assert.equal(await handle.evaluate(el=>getComputedStyle(el).cursor),'ew-resize','scrub area uses horizontal resize cursor');
   assert.equal(await handle.locator('svg').count(),1,'horizontal move icon is visible in the scrub area');
   assert.equal(await handle.locator('svg path').getAttribute('d'),'M5 3 1 8l4 5M1 8h14M11 3l4 5-4 5','scrub area uses the selected left-right move icon');
   assert.equal(await handle.locator('svg').evaluate(el=>getComputedStyle(el).pointerEvents),'none','icon does not intercept scrub dragging');
   const scrubStyle=await handle.evaluate(el=>{const style=getComputedStyle(el),icon=getComputedStyle(el.querySelector('svg'));return{iconWidth:icon.width,borderLeftStyle:style.borderLeftStyle,backgroundColor:style.backgroundColor};});
   assert.equal(scrubStyle.iconWidth,'10px','horizontal move icon stays compact');
   assert.equal(scrubStyle.borderLeftStyle,'solid','scrub area is divided from direct numeric entry');
   assert.notEqual(scrubStyle.backgroundColor,'rgba(0, 0, 0, 0)','scrub area keeps a visible background');
   const initial=await width.inputValue();
   await drag(page,handle,0);
   assert.equal(await width.inputValue(),initial,'click without horizontal drag keeps value');

   await drag(page,handle,40);
   assert.equal(Number(await width.inputValue()),Number(initial)+.2,'right drag increases decimal value');
   await drag(page,handle,-20);
   assert.equal(Number(await width.inputValue()),Number(initial)+.1,'left drag decreases decimal value');

   await width.fill('12.34');
   await width.press('Enter');
   assert.equal(await width.inputValue(),'12.34','direct numeric input remains available');

   const levels=page.locator('[data-rack-property=levels]'),levelHandle=levels.locator('xpath=following-sibling::*[@data-number-scrub]');
   const levelStart=Number(await levels.inputValue());
   await drag(page,levelHandle,16);
   assert.equal(Number(await levels.inputValue()),levelStart+2,'integer drag follows integer steps');

   const lock=page.locator('[data-action=toggleRackLock]');
   await lock.click();
   assert.ok(await width.isDisabled());
   assert.equal(await handle.evaluate(el=>getComputedStyle(el).pointerEvents),'none','locked number scrub area is inactive');
   await lock.click();

   assert.equal(await page.locator('input[type=number][data-number-kind]').count(),await page.locator('[data-number-scrub]').count(),'every visible numeric input has one scrub area');
   console.log((editor?'Editor':'Viewer')+': PASS hidden spinner replacement, horizontal scrub increase/decrease, direct entry, integer steps and lock state');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
