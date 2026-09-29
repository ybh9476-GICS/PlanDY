const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const M=require('../js/floor-plan-model.js');
const before=process.argv.includes('--before');
const editor=process.argv.includes('--editor');
const meter=value=>Number(value).toFixed(2);

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:1500,height:1050}});
  const plan=M.sample();
  plan.objects.push({id:'BT01',kind:'BT',x:20,y:2,w:2,h:1.5,angle:0,conveyorId:'CV01',offset:0,flowDirection:'forward',locked:false});
  const key='wms-floor-plan-editor-draft-v2:custom-1789604650974';
  await context.addInitScript(({key,plan})=>{localStorage.setItem(key,JSON.stringify(plan));localStorage.removeItem(key+':tabs-v1');},{key,plan});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
  await page.locator('#loginUserId').fill(editor?'edituser':'viewuser');
  await page.locator('#loginPassword').fill(editor?'edit!@#$':'view1234');
  await page.locator('#loginSubmitBtn').click();
  await page.locator('.fp-editor').waitFor();
  const select=id=>page.locator('.fp-list [data-select="'+id+'"]').click();
  const mapInfo=id=>before?page.locator('.fp-map-object[data-id="'+id+'"] > text').last():id==='W01'?page.locator('.fp-selected-info text'):page.locator('.fp-map-object[data-id="'+id+'"] > text.fp-object-info').last();
  const fieldLabel=name=>page.locator('[data-field="'+name+'"]').locator('..').evaluate(el=>el.childNodes[0].textContent.trim());

  await select('W01');
  if(before){
   assert.equal(await mapInfo('W01').textContent(),'W01');
   assert.equal(await page.locator('.fp-dim').textContent(),'4.00 × 3.00 m · 0°');
   assert.equal(await fieldLabel('w'),'배치 가로 (m)');
   assert.ok(await page.locator('[data-field=w]').evaluate(el=>document.querySelector('[data-rack-property=bayWidth]').compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING));
   await select('CV01');
   assert.equal(await mapInfo('CV01').textContent(),'CV01');
   assert.equal(await page.locator('.fp-dim').textContent(),'폭 1.50 m · 길이 7.50 m');
   assert.ok(await page.locator('[data-detail]').evaluate(el=>el.compareDocumentPosition(document.querySelector('.fp-path-actions'))&Node.DOCUMENT_POSITION_FOLLOWING));
   console.log('Reproduced separate object code and selected dimensions, old rack labels/order, and path total before the edit controls');
  }else{
   for(const id of ['W01','BT01','B01','D01','S01']){
    const object=plan.objects.find(item=>item.id===id);
    const layout=object.kind==='W'?M.rackLayout(object,plan):null,width=layout?.actualW??object.w,height=layout?.actualH??object.h;
    assert.equal(await mapInfo(id).textContent(),`${id} : ${meter(width)} m x ${meter(height)} m , ${M.round(object.angle||0)}°`);
   }
   for(const id of ['T01','GR01','CV01']){
    const object=plan.objects.find(item=>item.id===id);
    assert.equal(await mapInfo(id).textContent(),`${id} : 폭 ${meter(object.width)} m , 총 길이 ${meter(M.totalPathLength(object))} m`);
   }
   assert.equal(await page.locator('.fp-dim').count(),0);
   const rackInfo=mapInfo('W01'),selection=page.locator('.fp-selection');
   assert.equal(await rackInfo.getAttribute('text-anchor'),'start');
   assert.equal(Number(await rackInfo.getAttribute('x')),Number(await selection.getAttribute('x'))+3);
   assert.ok(Number(await rackInfo.getAttribute('y'))<Number(await selection.getAttribute('y')));
   assert.equal(await fieldLabel('w'),'전체 가로 (m)');
   assert.equal(await fieldLabel('h'),'전체 세로 (m)');
   const rackPropertyLabel=name=>page.locator('[data-rack-property="'+name+'"]').locator('..').evaluate(el=>el.childNodes[0].textContent.trim());
   assert.equal(await rackPropertyLabel('bayWidth'),'베이 폭 (m)');
   assert.equal(await rackPropertyLabel('depth'),'베이 깊이 (m)');
   assert.equal(await fieldLabel('bayGap'),'베이 폭 간격 (m)');
   assert.equal(await fieldLabel('rowGap'),'베이 깊이 간격 (m)');
   assert.equal(await rackPropertyLabel('depthCount'),'베이 깊이 팔레트 수');
   const rightHandle=page.locator('[data-panel-resizer="right"]');
   await rightHandle.focus();
   await page.keyboard.press('Home');
   assert.ok(await page.locator('.fp-inspector').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   assert.ok(await page.locator('[data-field=w]').evaluate(el=>el.compareDocumentPosition(document.querySelector('[data-rack-property=bayWidth]'))&Node.DOCUMENT_POSITION_FOLLOWING));
   await select('BT01');
   assert.equal(await fieldLabel('w'),'가로 길이 (m)');
   assert.equal(await fieldLabel('h'),'세로 길이 (m)');
   await select('B01');
   assert.equal(await fieldLabel('w'),'가로 길이 (m)');
   assert.equal(await fieldLabel('h'),'세로 길이 (m)');
   await select('CV01');
   const detail=page.locator('[data-detail]');
   assert.match(await detail.textContent(),/중심선 총 길이 7\.50 m/);
   assert.equal(await detail.locator('xpath=preceding-sibling::hr[1]').count(),1);
   assert.ok(await detail.evaluate(el=>el.compareDocumentPosition(document.querySelector('.fp-path-actions'))&Node.DOCUMENT_POSITION_FOLLOWING));
   console.log((editor?'Editor':'Viewer')+': PASS combined map information for W/BT/B/D/S and T/GR/CV, renamed rack fields, and relocated path total');
  }
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
