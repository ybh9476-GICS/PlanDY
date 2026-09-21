const {chromium}=require(process.env.PLANDY_PLAYWRIGHT);
const assert=require('assert/strict');
const M=require('../js/floor-plan-model.js');
const before=process.argv.includes('--before'),viewer=process.argv.includes('--viewer');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const plan=M.sample(),track=plan.objects.find(o=>o.id==='ST01');
  track.points=[{x:2,y:7},{x:18,y:7}];
  track.branches=[
   {id:'B1',from:0,points:[{x:5,y:10},{x:8,y:12}]},
   {id:'B2',from:1,points:[{x:18,y:12}]},
   {id:'B3',parent:'B1',from:1,points:[{x:11,y:10}]}
  ];
  const context=await browser.newContext({viewport:{width:1540,height:1050}});
  await context.addInitScript(({key,plan})=>localStorage.setItem(key,JSON.stringify(plan)),{key:'wms-floor-plan-editor-draft-v2:custom-1789604650974',plan});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4173/#custom-1789604650974');
  await page.locator('#loginUserId').fill(viewer?'viewuser':'edituser');
  await page.locator('#loginPassword').fill(viewer?'view1234':'edit!@#$');
  await page.locator('#loginSubmitBtn').click();
  await page.locator('.fp-editor').waitFor();
  await page.locator('.fp-list [data-select=ST01]').click();
  const select=page.locator('[data-field=segment]');
  if(before){
   assert.equal(await select.locator('option').count(),1);
   assert.deepEqual(await select.locator('option').allTextContents(),['1 → 2']);
   assert.equal(await select.locator('..').evaluate(el=>el.childNodes[0].textContent.trim()),'구간 편집');
   console.log('Reproduced: dropdown only lists the active main path and is labeled 구간 편집');
   return;
  }
  assert.equal(await select.locator('..').evaluate(el=>el.childNodes[0].textContent.trim()),'구간 선택');
  assert.deepEqual(await select.locator('option').allTextContents(),[
   '1 → 2',
   '　1 → 1-1',
   '　1-1 → 1-2',
   '　　1-1 → 1-1-1',
   '　2 → 2-1'
  ]);
  await select.selectOption({label:'　1-1 → 1-2'});
  assert.equal(await page.locator('[data-branch-select="0"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-segment-hit="1"][data-segment-branch="0"]').getAttribute('class'),'fp-segment-hit is-selected');
  await page.locator('[data-field=segment]').selectOption({label:'　　1-1 → 1-1-1'});
  assert.equal(await page.locator('[data-branch-select="2"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-segment-hit="0"][data-segment-branch="2"]').getAttribute('class'),'fp-segment-hit is-selected');
  await page.locator('[data-field=segment]').selectOption({label:'1 → 2'});
  assert.equal(await page.locator('[data-branch-select="-1"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-segment-hit="0"][data-segment-branch="-1"]').getAttribute('class'),'fp-segment-hit is-selected');
  console.log((viewer?'Viewer':'Editor')+': PASS hierarchical main, branch and recursive-branch segment dropdown with canvas selection sync');
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});