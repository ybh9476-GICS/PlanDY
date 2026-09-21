(function(){
'use strict';
let library=null,token='',expires=0,inflight=false;
const headers=['랙타입코드','랙타입명','베이폭(m)','깊이(m)','전체높이(m)','단수','단당높이(m)','깊이수'],placementHeaders=['배치 가로(m)','배치 세로(m)','베이 사이 간격(m)','랙열 사이 간격(m)'];
function schema(labels){const a=(labels||[]).map(v=>String(v??'').trim());while(a.at(-1)==='')a.pop();return JSON.stringify(a)===JSON.stringify(headers)?8:JSON.stringify(a)===JSON.stringify([...headers,...placementHeaders])?12:0;}
function placementData(values){const result={};for(const k of ['placementW','placementH','bayGap','rowGap']){const v=values?.[k];if(v===undefined||v===null||String(v).trim()==='')continue;result[k]=Number(v);if(!Number.isFinite(result[k]))throw Error("배치 크기·간격은 유효한 숫자로 입력하세요.");}if(Object.keys(result).length){const m=window.WmsFloorPlanModel;if((result.placementW!==undefined&&result.placementW<.01)||(result.placementH!==undefined&&result.placementH<.01))throw Error('배치 가로·세로는 0.01 m 이상으로 입력하세요.');m.read({...m.blank(),width:200,height:200,objects:[{id:'CHECK',kind:'W',x:0,y:0,w:result.placementW??1,h:result.placementH??1,angle:0,locked:false,rackTypeId:'',bayGap:result.bayGap??0,rowGap:result.rowGap??0}]});}return result;}
function sameRow(a,b){if(!Array.isArray(a))return false;const trim=v=>{const n=[...v];while(n.length&&(n.at(-1)===''||n.at(-1)==null))n.pop();return n;};return JSON.stringify(trim(a))===JSON.stringify(trim(b));}
function config(){const c=window.WMS_RACK_MASTER_CONFIG;if(!c?.clientId)throw Error('Google OAuth 웹 클라이언트 ID 설정이 필요합니다. 원본 마스터에는 아직 저장되지 않았습니다.');return c;}
function prepare(){if(!window.WMS_RACK_MASTER_CONFIG?.clientId||window.google?.accounts?.oauth2)return Promise.resolve();if(!library)library=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>{library=null;script.remove();reject(Error('Google 연결을 불러오지 못했습니다. 다시 시도하세요.'));};document.head.append(script);});library.catch(()=>{});return library;}
function authorize(){const c=config();if(token&&Date.now()<expires)return Promise.resolve(token);if(!window.google?.accounts?.oauth2)throw Error('Google 연결을 준비 중입니다. 잠시 후 저장 버튼을 다시 누르세요.');return new Promise((resolve,reject)=>{window.google.accounts.oauth2.initTokenClient({client_id:c.clientId,scope:'https://www.googleapis.com/auth/spreadsheets',callback:r=>{if(!r.access_token)return reject(Error('Google 시트 쓰기 권한을 허용해야 저장할 수 있습니다.'));token=r.access_token;expires=Date.now()+(Number(r.expires_in)||300)*1000-30000;resolve(token);},error_callback:()=>reject(Error('Google 연결이 취소되었거나 팝업이 차단되었습니다. 다시 저장을 눌러주세요.'))}).requestAccessToken({prompt:''});});}
function stamp(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),v=k=>parts.find(p=>p.type===k).value;return `${v('year')}-${v('month')}-${v('day')} ${v('hour')}:${v('minute')}:${v('second')}`;}
function uniqueName(name,rows){if(!rows.some(r=>String(r[1]??'').trim()===name))return name;const suffix=' '+stamp();let n=name.slice(0,60-suffix.length)+suffix,i=2;while(rows.some(r=>String(r[1]??'').trim()===n)){const extra=' '+i++;n=name.slice(0,60-suffix.length-extra.length)+suffix+extra;}return n;}
function generateCode(){return 'RACK-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,6).toUpperCase();}
function normalizeCode(code){return String(code??'').trim().toUpperCase();}
function validateCode(code){const id=normalizeCode(code);if(!/^[A-Z][A-Z0-9_-]{0,23}$/.test(id))throw Error('랙타입코드는 영문으로 시작하고 영문·숫자·하이픈(-)·밑줄(_)로 1~24자를 입력하세요.');return id;}
function parseTable(table){
 const columns=table?schema(table.cols?.map(c=>c.label)):0;
 if(!columns)throw Error('랙타입 마스터 열 구성이 변경되었습니다. 기존 목록을 유지합니다.');
 if(!Array.isArray(table.rows)||table.rows.length>20000)throw Error('랙타입 마스터 행 구성을 확인할 수 없습니다.');
 const seen=new Set(),m=window.WmsFloorPlanModel;
 return table.rows.flatMap((row,index)=>{const cells=row.c?.map(c=>c?.v??'')||[];if(cells.every(v=>String(v).trim()===''))return [];try{const id=validateCode(cells[0]);if(seen.has(id))throw Error('랙타입코드가 중복됩니다: '+id);seen.add(id);const numeric=i=>{if(String(cells[i]??'').trim()==='')throw Error(headers[i]+' 값이 없습니다.');return Number(cells[i]);},type={id,name:String(cells[1]??'').trim(),bayWidth:numeric(2),depth:numeric(3),height:numeric(4),levels:numeric(5),levelHeight:numeric(6),depthCount:numeric(7)};return [{...m.read({...m.blank(),rackTypes:[type]}).rackTypes[0],...(columns===12?placementData({placementW:cells[8],placementH:cells[9],bayGap:cells[10],rowGap:cells[11]}):{})}];}catch(error){throw Error('랙타입 마스터 '+(index+5)+'행: '+error.message);}});
}
function load({signal}={}){const c=window.WMS_RACK_MASTER_CONFIG;if(!/^[A-Za-z0-9_-]{20,}$/.test(c?.spreadsheetId||'')||!c?.sheetName)return Promise.reject(Error('기준정보 시트 연결 설정을 확인하세요.'));
 return new Promise((resolve,reject)=>{if(signal?.aborted){reject(new DOMException('요청이 취소되었습니다.','AbortError'));return;}const callback='__wmsRackMaster_'+Date.now()+'_'+Math.random().toString(36).slice(2),script=document.createElement('script');let settled=false;
 const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);script.remove();delete window[callback];fn(value);},cancel=()=>finish(reject,new DOMException('요청이 취소되었습니다.','AbortError'));
 const timer=setTimeout(()=>finish(reject,Error('기준정보 응답 시간이 초과되었습니다. 기존 목록을 유지합니다.')),20000);
 window[callback]=response=>{try{if(response?.status!=='ok')throw Error('기준정보 시트를 읽지 못했습니다. 공유 권한과 시트명을 확인하세요.');finish(resolve,parseTable(response.table));}catch(error){finish(reject,error);}};
 script.async=true;script.referrerPolicy='no-referrer';script.src='https://docs.google.com/spreadsheets/d/'+c.spreadsheetId+'/gviz/tq?tqx=responseHandler:'+callback+'&sheet='+encodeURIComponent(c.sheetName)+'&range=A4%3AL&headers=1&_='+Date.now();script.onerror=()=>finish(reject,Error('기준정보 시트 연결에 실패했습니다. 기존 목록을 유지합니다.'));signal?.addEventListener('abort',cancel,{once:true});document.head.append(script);
 });
}
async function save(type,name,{code,placement,onName=()=>{},canWrite=()=>false}={}){
 if(inflight)throw Error('이미 저장 중입니다. 저장 결과를 기다려주세요.');if(!canWrite())throw Error('현재 편집 세션에서 저장할 수 없습니다.');name=name.trim();if(!name||name.length>60)throw Error('랙타입명은 1~60자로 입력하세요.');
 const requestedCode=code===undefined?undefined:validateCode(code),c=config(),auth=authorize();inflight=true;
 try{const access=await auth,base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(c.spreadsheetId),a1="'"+c.sheetName.replaceAll("'","''")+"'!",url=range=>base+'/values/'+encodeURIComponent(a1+range);
  const request=async(endpoint,options={})=>{const response=await fetch(endpoint,{...options,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'}});if(!response.ok){if(response.status===401){token='';expires=0;}throw Error(response.status===403?'이 Google 계정에 랙타입 마스터 편집 권한이 없습니다.':response.status===401?'Google 연결이 만료되었습니다. 저장을 다시 눌러주세요.':'Google 시트 요청 실패 ('+response.status+').');}return response.json();};
  const metadata=await request(base+'?fields=sheets(properties(sheetId,title,gridProperties))'),sheet=metadata.sheets?.find(s=>s.properties.title===c.sheetName);if(!sheet||sheet.properties.sheetId!==c.sheetId)throw Error('대상 랙타입 마스터를 확인하지 못했습니다. 저장하지 않았습니다.');
  const header=await request(url('A4:L4')),columns=schema(header.values?.[0]);if(!columns)throw Error('랙타입 마스터 열 구성이 변경되었습니다. 저장하지 않았습니다.');if(columns===8&&placement)throw Error('랙타입 마스터에 배치 크기·간격 열이 필요합니다. 저장하지 않았습니다.');const end=columns===12?'L':'H';
  const count=sheet.properties.gridProperties.rowCount;if(count>20000)throw Error('마스터가 너무 커서 중복 이름을 안전하게 확인할 수 없습니다.');const rows=(await request(url('A5:'+end+count)+'?valueRenderOption=UNFORMATTED_VALUE')).values||[];
  const exists=id=>rows.some(r=>normalizeCode(r[0])===id);let id=requestedCode;if(id!==undefined&&exists(id)){const error=Error('랙타입코드 '+id+'는 이미 사용 중입니다. 다른 코드를 입력하세요.');error.duplicateCode=true;throw error;}if(id===undefined){do{id=generateCode();}while(exists(id));}
  name=uniqueName(name,rows);onName(name);
  const m=window.WmsFloorPlanModel,layout=placementData(placement?{placementW:placement.w,placementH:placement.h,bayGap:placement.bayGap,rowGap:placement.rowGap}:type),row=[id,name,m.roundMeters(type.bayWidth),m.roundMeters(type.depth),m.roundMeters(type.height),type.levels,m.roundMeters(type.levelHeight??type.height/type.levels),type.depthCount];if(columns===12)row.push(...['placementW','placementH','bayGap','rowGap'].map(k=>layout[k]===undefined?'':m.roundMeters(layout[k])));const resultType={...type,...(columns===12?placementData({placementW:row[8],placementH:row[9],bayGap:row[10],rowGap:row[11]}):{}),id,name,bayWidth:row[2],depth:row[3],height:row[4],levels:row[5],levelHeight:row[6],depthCount:row[7]};m.read({...m.blank(),rackTypes:[resultType]});
  if(!canWrite())throw Error('편집 세션이 종료되어 저장하지 않았습니다.');let result;
  try{result=await request(url('A4:'+end+count)+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=true',{method:'POST',body:JSON.stringify({majorDimension:'ROWS',values:[row]})});}catch(error){
   // An interrupted POST may have succeeded. Read by unique code before allowing retry.
   try{const found=(await request(url('A5:'+end+(count+1))+'?valueRenderOption=UNFORMATTED_VALUE')).values?.find(r=>r[0]===id);if(sameRow(found,row))return resultType;if(!found&&/Google 시트 요청 실패|권한|만료/.test(error.message))throw error;}catch(checkError){if(checkError===error)throw error;}
   const uncertain=Error('저장 결과를 확인하지 못했습니다. 중복 추가를 막기 위해 이 창에서 재시도를 중지합니다. 원본 마스터에서 '+id+' 코드를 확인하세요.');uncertain.uncertain=true;throw uncertain;
  }
  if(!result.updates?.updatedRange||result.updates.updatedRows!==1){const error=Error('저장 응답을 확인하지 못했습니다. 원본 마스터에서 '+id+' 코드를 확인하세요.');error.uncertain=true;throw error;}
  try{const verified=await request(base+'/values/'+encodeURIComponent(result.updates.updatedRange)+'?valueRenderOption=UNFORMATTED_VALUE');if(!sameRow(verified.values?.[0],row))throw Error('mismatch');}catch{const error=Error('추가는 처리됐지만 저장 결과 확인이 실패했습니다. 중복 추가를 막기 위해 재시도를 중지합니다. 원본 마스터에서 '+id+' 코드를 확인하세요.');error.uncertain=true;throw error;}
  return resultType;
 }finally{inflight=false;}
}
window.addEventListener('wms-role-change',()=>{token='';expires=0;});
window.WmsRackMaster={prepare,save,generateCode,validateCode,load,parseTable};
})();
