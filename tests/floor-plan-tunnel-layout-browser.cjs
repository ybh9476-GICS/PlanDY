const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const fs=require('fs');
const M=require('../js/floor-plan-model.js');
const before=process.argv.includes('--before');
const editor=process.argv.includes('--editor');
const baseUrl=process.env.PLANDY_TEST_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:1500,height:1050}});
  const plan=M.sample();plan.objects.push({id:'BT01',kind:'BT',x:20,y:20,w:2,h:1.5,angle:0,conveyorId:'CV01',offset:5,locked:false});
  const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';
  await context.addInitScript(({key,plan})=>{localStorage.setItem(key,JSON.stringify(plan));localStorage.removeItem(key+':tabs-v1');},{key,plan});
  const page=await context.newPage();
  await page.goto(baseUrl+'/#custom-1789604650974');
  await page.waitForTimeout(1000);
  await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
  await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
  await page.locator('#loginSubmitBtn').click();
  await page.locator('.fp-editor').waitFor();
  await page.locator('.fp-list [data-select=BT01]').click();
  if(before){
   assert.equal(await page.locator('.fp-prop-top h3').textContent(),'선택 대상 · 스캔 터널');
   assert.equal(await page.locator('.fp-pending').count(),1);
   assert.equal(await page.locator('[data-field=id]').locator('..').evaluate(el=>el.childNodes[0].textContent.trim()),'대상 코드');
   assert.equal(await page.locator('[data-lock]').count(),1);
   assert.equal(await page.locator('[data-action=toggleObjectLock]').count(),0);
   const axis=page.locator('[data-axis-panel]');
   assert.ok(await axis.evaluate((el,size)=>el.compareDocumentPosition(document.querySelector('[data-field=w]'))&Node.DOCUMENT_POSITION_FOLLOWING),'axis currently appears before tunnel size');
   console.log('Reproduced generic tunnel title/code, bottom checkbox lock and axis-before-properties layout');
  }else{
   assert.equal(await page.locator('.fp-prop-top h3').textContent(),'스캔 터널 정보');
   assert.equal(await page.locator('.fp-pending').count(),0);
   assert.equal(await page.locator('[data-field=id]').locator('..').evaluate(el=>el.childNodes[0].textContent.trim()),'스캔 터널 코드');
   assert.equal(await page.locator('[data-lock]').count(),0);
   const lock=page.locator('[data-action=toggleObjectLock]');
   assert.equal(await lock.count(),1);
   const expected=['id','w','h','angle','conveyorId','offset','x','y'];
   assert.deepEqual(await page.locator('[data-field]').evaluateAll(elements=>elements.map(el=>el.dataset.field)),expected);
   assert.equal(await page.locator('[data-field=anchor]').count(),0);
   assert.equal(await page.locator('[data-field=x]').locator('..').evaluate(el=>el.childNodes[0].textContent.trim()),'중심 X (m)');
   assert.equal(await page.locator('[data-field=y]').locator('..').evaluate(el=>el.childNodes[0].textContent.trim()),'중심 Y (m)');
   assert.equal(await page.locator('[data-field=x]').inputValue(),'21.00');
   assert.equal(await page.locator('[data-field=y]').inputValue(),'20.75');
   const props=page.locator('.fp-tunnel-properties'),axis=page.locator('[data-axis-panel]'),position=page.locator('.fp-tunnel-position');
   assert.equal(await props.count(),1);
   assert.ok(await props.evaluate(el=>el.compareDocumentPosition(document.querySelector('[data-axis-panel]'))&Node.DOCUMENT_POSITION_FOLLOWING),'properties precede axis');
   assert.ok(await axis.evaluate(el=>el.compareDocumentPosition(document.querySelector('.fp-tunnel-position'))&Node.DOCUMENT_POSITION_FOLLOWING),'axis precedes X/Y');
   assert.equal(await props.locator('[data-action=alignTunnel]').count(),1);
   assert.equal(await props.locator('[data-action=alignTunnel] .fp-position-direction-icon').count(),1);
   const offsetLabel=props.locator('[data-field=offset]').locator('..'),alignButton=props.locator('[data-action=alignTunnel]');
   assert.ok(await offsetLabel.evaluate(element=>element.classList.contains('fp-full')),'installation distance spans the full property grid');
   const [offsetBox,alignBox]=await Promise.all([offsetLabel.boundingBox(),alignButton.boundingBox()]);
   assert.ok(Math.abs(offsetBox.width-alignBox.width)<1,'installation distance matches the full-width alignment button');
   if(editor){fs.mkdirSync('output/floor-plan-position-direction-icon',{recursive:true});await page.screenshot({path:'output/floor-plan-position-direction-icon/editor.png',fullPage:true});}
   assert.equal(await page.locator('[data-action=rotate]').count(),0);
   assert.equal(await page.locator('[data-action=objectClockwise],[data-action=objectCounterclockwise]').count(),2);
   assert.equal(await page.locator('[data-action=delete]').count(),1);
   await lock.click();
   for(const name of ['w','h','angle','conveyorId','offset','x','y'])assert.ok(await page.locator('[data-field='+name+']').isDisabled(),name+' is locked');
   assert.ok(await lock.isEnabled());
   await lock.click();
   await page.locator('[data-field=w]').fill('2.50');
   await page.locator('[data-field=w]').press('Enter');
   assert.equal(await page.locator('[data-field=w]').inputValue(),'2.50');
   await page.locator('[data-action=alignTunnel]').click();
   assert.equal(await page.locator('.fp-prop-error').textContent(),'');
   const angle=Number(await page.locator('[data-field=angle]').inputValue());
   await page.locator('[data-action=objectClockwise]').click();
   assert.equal(Number(await page.locator('[data-field=angle]').inputValue()),(angle+90)%360);
   await page.locator('[data-action=objectCounterclockwise]').click();
   assert.equal(Number(await page.locator('[data-field=angle]').inputValue()),angle);
   await page.locator('.fp-list [data-select=W01]').click();
   assert.equal(await page.locator('.fp-prop-top h3').textContent(),'랙 기준 정보');
   assert.equal(await page.locator('[data-action=toggleRackLock]').count(),1);
   for(const [id,name,x,y] of [['B01','버퍼','23.50','13.00'],['D01','도크','24.00','20.50'],['S01','스테이션','19.50','6.00']]){
    await page.locator('.fp-list [data-select='+id+']').click();
    assert.equal(await page.locator('.fp-prop-top h3').textContent(),name+' 정보');
    assert.equal(await page.locator('.fp-pending').count(),0);
    assert.equal(await page.locator('[data-field=id]').locator('..').evaluate(el=>el.childNodes[0].textContent.trim()),name+' 코드');
    assert.deepEqual(await page.locator('[data-field]').evaluateAll(elements=>elements.map(el=>el.dataset.field)),['id','w','h','angle','x','y']);
    assert.equal(await page.locator('[data-field=anchor]').count(),0);
    assert.equal(await page.locator('[data-lock]').count(),0);
    assert.equal(await page.locator('[data-field=x]').inputValue(),x);
    assert.equal(await page.locator('[data-field=y]').inputValue(),y);
    const objectProps=page.locator('.fp-object-properties'),objectAxis=page.locator('[data-axis-panel]'),objectPosition=page.locator('.fp-object-position');
    assert.ok(await objectProps.evaluate(el=>el.compareDocumentPosition(document.querySelector('[data-axis-panel]'))&Node.DOCUMENT_POSITION_FOLLOWING),name+' properties precede axis');
    assert.ok(await objectAxis.evaluate(el=>el.compareDocumentPosition(document.querySelector('.fp-object-position'))&Node.DOCUMENT_POSITION_FOLLOWING),name+' axis precedes position');
    const objectLock=page.locator('[data-action=toggleObjectLock]');
    assert.equal(await objectLock.count(),1);
    await objectLock.click();
    for(const field of ['w','h','angle','x','y'])assert.ok(await page.locator('[data-field='+field+']').isDisabled(),name+' '+field+' is locked');
    assert.ok(await page.locator('[data-action=delete]').isDisabled());
    assert.ok(await objectLock.isEnabled());
    await objectLock.click();
   }
   if(editor){fs.mkdirSync('output/floor-plan-static-object-layout',{recursive:true});await page.screenshot({path:'output/floor-plan-static-object-layout/editor.png',fullPage:true});}
   console.log((editor?'Editor':'Viewer')+': PASS scan tunnel and B/D/S named code headers, header locks, property-axis-position layouts, fixed coordinates and preserved actions');
  }
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
