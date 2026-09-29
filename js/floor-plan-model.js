(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WmsFloorPlanModel=api;}(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const kinds=Object.freeze({W:'랙',T:'AMR 통로',GR:'가이드 레일',ST:'가이드 레일',CV:'컨베이어',BT:'스캔 터널',B:'버퍼',D:'도크',S:'스테이션'}),toolKinds=Object.freeze(['W','T','GR','CV','BT','B','D','S']),pathKinds=['T','GR','ST','CV'];
const clone=v=>JSON.parse(JSON.stringify(v)),round=n=>Math.round(n*1000)/1000,snap=(n,step=.5)=>round(Math.round(n/step)*step),distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const samePoint=(a,b)=>distance(a,b)<.0009,refKey=ref=>ref.line+':'+ref.index;
// Display/input precision is separate from geometry and existing document precision.
const roundMeters=n=>Math.round((n+Math.sign(n)*Number.EPSILON)*100)/100,formatMeters=n=>{const v=roundMeters(n);return (Object.is(v,-0)?0:v).toFixed(2);};
function number(v,label,min=0,max=200){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||Math.abs(v-round(v))>1e-7)throw new Error(label+': '+min+'~'+max+' 범위에서 소수 셋째 자리까지 입력하세요.');return v;}
function code(v,label){if(typeof v!=='string'||! /^[A-Z][A-Z0-9_-]{0,23}$/.test(v))throw new Error(label+': 영문 대문자·숫자·밑줄·하이픈, 24자 이내로 입력하세요.');return v;}
const axisKeys=['topLeft','topRight','center','bottomLeft','bottomRight'];
function axisPoint(o,key=o.snapAnchor||'topLeft'){if(o.points||!axisKeys.includes(key))throw Error('축 설정을 확인하세요.');const b=bounds(o),offset={topLeft:[0,0],topRight:[1,0],center:[.5,.5],bottomLeft:[0,1],bottomRight:[1,1]}[key];return {x:b.x+b.w*offset[0],y:b.y+b.h*offset[1]};}
function moveAxis(o,x,y,key=o.snapAnchor||'topLeft'){const pt=axisPoint(o,key);o.x=round(o.x+x-pt.x);o.y=round(o.y+y-pt.y);}
function legacyTypes(){return[{id:'RACK-01',name:'예시 표준 랙',bayWidth:2,depth:1,height:6,levels:4,depthCount:1},{id:'RACK-02',name:'예시 정밀 랙',bayWidth:1.23,depth:1.23,height:6,levels:4,depthCount:2}];}
// Read-only snapshot of 기준정보 / 랙타입 마스터 (2026-09-17), meters.
const rackPresets=[{"id":"PALLET-4L","name":"팔레트 랙 4단","bayWidth":1,"depth":4,"height":10,"levels":10,"levelHeight":1,"depthCount":4},{"id":"PALLET-4L-DBL","name":"팔레트 랙 4단","bayWidth":2.5,"depth":2.5,"height":6,"levels":4,"levelHeight":1.4,"depthCount":2},{"id":"SHELF-5L","name":"경량 선반 5단","bayWidth":1.5,"depth":0.5,"height":2.4,"levels":5,"levelHeight":0.4,"depthCount":1},{"id":"PALLET-3L-DBL","name":"양면 팔레트 랙 3단","bayWidth":2.5,"depth":2,"height":5.2,"levels":3,"levelHeight":1.6,"depthCount":2},{"id":"FLOOR","name":"바닥 적치","bayWidth":1.5,"depth":1,"height":1.5,"levels":1,"levelHeight":1.5,"depthCount":1}];
function defaultTypes(){return clone(rackPresets);}
function blank(){return{format:'plandy-floor-editor',version:2,name:'나의 평면도',width:30,height:24,grid:.5,rackTypes:defaultTypes(),objects:[]};}
function migrate(value){
 if(value?.format!=='plandy-floor-editor'||![1,2].includes(value.version))throw new Error('지원하는 에디터 JSON 파일이 아닙니다.');
 if(value.version===2)return clone(value);
 const p=clone(value);p.version=2;p.rackTypes=legacyTypes();
 if(!Array.isArray(p.objects))throw new Error('대상 목록이 올바르지 않습니다.');
 p.objects=p.objects.map(o=>{
  if(!o||typeof o!=='object')throw new Error('기존 대상 정보가 올바르지 않습니다.');
  if(o.points){if(!Array.isArray(o.points)||typeof o.width!=='number')throw new Error('기존 통로 정보가 올바르지 않습니다.');o.points=o.points.map(v=>({x:round(v.x+o.width/2),y:round(v.y+o.width/2)}));o.cap='legacy-square';}
  else{o.angle=0;if(o.kind==='W'){o.rackTypeId='';o.bayGap=0;o.rowGap=0;}if(o.kind==='BT'){o.conveyorId='';o.offset=0;}}
  return o;
 });return p;
}
function sample(){const p=blank();p.name='연습용 창고';p.objects=[...[2,8,14].map((x,i)=>({id:'W0'+(i+1),kind:'W',x,y:3,w:4,h:3,angle:0,rackTypeId:'PALLET-4L-DBL',bayGap:0,rowGap:0,locked:false})),...[2,8,14].map((x,i)=>({id:'W0'+(i+4),kind:'W',x,y:9,w:4,h:3,angle:0,rackTypeId:'PALLET-4L-DBL',bayGap:0,rowGap:0,locked:false})),{id:'GR01',kind:'GR',points:[{x:2,y:7},{x:19.5,y:7}],width:1.5,cap:'butt',segmentDirections:{main:['forward']},locked:false},{id:'S01',kind:'S',x:19.5,y:6,w:2,h:2,angle:0,locked:false},{id:'T01',kind:'T',points:[{x:22.5,y:7},{x:22.5,y:14.5}],width:2,cap:'butt',segmentDirections:{main:['forward']},locked:false},{id:'B01',kind:'B',x:23.5,y:13,w:3,h:3,angle:0,locked:false},{id:'CV01',kind:'CV',points:[{x:27.25,y:13},{x:27.25,y:20.5}],width:1.5,cap:'butt',segmentDirections:{main:['forward']},locked:false},{id:'D01',kind:'D',x:24,y:20.5,w:5,h:2.5,angle:0,locked:false}];return p;}
function read(value){
 const v=migrate(value);number(v.width,'도면 가로',5);number(v.height,'도면 세로',5);number(v.grid,'격자 간격',.001,10);
 if(typeof v.name!=='string'||!v.name.trim()||v.name.length>80)throw new Error('도면 이름은 1~80자여야 합니다.');
 if(!Array.isArray(v.rackTypes)||v.rackTypes.length>50)throw new Error('랙타입은 최대 50개입니다.');
 const typeIds=new Set();const rackTypes=v.rackTypes.map(t=>{
  if(!t)throw new Error('랙타입 정보가 올바르지 않습니다.');const id=code(t.id,'랙타입 코드');if(typeIds.has(id))throw new Error('랙타입 코드가 중복됩니다.');typeIds.add(id);
  if(typeof t.name!=='string'||!t.name.trim()||t.name.length>60)throw new Error('랙타입 명칭은 1~60자여야 합니다.');
  const n={id,name:t.name.trim(),bayWidth:number(t.bayWidth,'베이폭',.001),depth:number(t.depth,'한 랙열 깊이',.001),height:number(t.height,'랙 높이',.001),levels:number(t.levels,'단수',1,100),depthCount:number(t.depthCount,'깊이 방향 셀 수',1,100)};
  if(t.levelHeight!==undefined)n.levelHeight=number(t.levelHeight,'단당 높이',.001);
  if(!Number.isInteger(n.levels)||!Number.isInteger(n.depthCount))throw new Error('단수와 깊이 방향 셀 수는 정수여야 합니다.');return n;
 });
 if(!Array.isArray(v.objects)||v.objects.length>500)throw new Error('대상은 최대 500개입니다.');
 const ids=new Set();const objects=v.objects.map(o=>{
  if(!o||!Object.hasOwn(kinds,o.kind))throw new Error('대상 종류가 올바르지 않습니다.');const id=code(o.id,'대상 코드');if(ids.has(id))throw new Error('대상 코드가 중복됩니다.');ids.add(id);
  const n={id,kind:o.kind,locked:o.locked===true};
  if((pathKinds.includes(o.kind)||o.kind==='BT')&&o.flowDirection!==undefined){if(!['forward','reverse'].includes(o.flowDirection))throw Error(id+': 팔레트 진행 방향을 확인하세요.');n.flowDirection=o.flowDirection;}
  if(pathKinds.includes(o.kind)){
   n.width=number(o.width,id+' 폭',.001,20);n.cap=o.cap==='legacy-square'?'legacy-square':'butt';
   if(!Array.isArray(o.points)||o.points.length<2||o.points.length>100)throw new Error(id+': 경로 지점은 2~100개입니다.');
   n.points=o.points.map((p,i)=>{if(!p)throw new Error(id+': 지점 정보를 확인하세요.');const pt={x:number(p.x,id+' 지점 X'),y:number(p.y,id+' 지점 Y')};if(i&&distance(pt,o.points[i-1])<.0009)throw new Error(id+': 인접한 지점을 같은 위치에 둘 수 없습니다.');return pt;});
   if(o.closed!==undefined){if(o.closed!==true)throw Error(id+': 닫힌 경로 정보를 확인하세요.');if(!['T','GR','CV'].includes(o.kind)||n.points.length<3)throw Error(id+': 닫힌 경로는 세 지점 이상이어야 합니다.');n.closed=true;}
    if(o.branches!==undefined){
    if(!Array.isArray(o.branches)||o.branches.length>20)throw Error(id+': 분기는 최대 20개입니다.');
    const branchIds=new Set();
    n.branches=o.branches.map(branch=>{
     if(!branch||typeof branch.id!=='string'||!/^B[1-9]\d*$/.test(branch.id)||branchIds.has(branch.id))throw Error(id+': 분기 식별자를 확인하세요.');
     branchIds.add(branch.id);
     if(!Number.isInteger(branch.from)||branch.from<0)throw Error(id+': 분기 시작점을 확인하세요.');
     if(branch.parent!==undefined&&(typeof branch.parent!=='string'||!/^B[1-9]\d*$/.test(branch.parent)))throw Error(id+': 상위 분기를 확인하세요.');
     if(!Array.isArray(branch.points)||(!branch.points.length&&branch.target===undefined))throw Error(id+': 분기에는 한 개 이상의 새 지점 또는 연결 포인트가 필요합니다.');
     const points=branch.points.map(p=>{if(!p)throw Error(id+': 분기 지점을 확인하세요.');return{x:number(p.x,id+' 분기 지점 X'),y:number(p.y,id+' 분기 지점 Y')};});
     for(let i=1;i<points.length;i++)if(distance(points[i],points[i-1])<.0009)throw Error(id+': 분기의 인접 지점을 같은 위치에 둘 수 없습니다.');
     const normalized={id:branch.id,from:branch.from,points};if(branch.parent!==undefined)normalized.parent=branch.parent;
     if(branch.target!==undefined){const target=branch.target;if(!target||typeof target.line!=='string'||!Number.isInteger(target.index)||target.index<0)throw Error(id+': 분기 연결 포인트를 확인하세요.');normalized.target={line:target.line,index:target.index};}
     return normalized;
    });
    const byId=new Map(n.branches.map(branch=>[branch.id,branch])),cache=new Map(),visiting=new Set();
    const resolve=branch=>{
     if(cache.has(branch.id))return cache.get(branch.id);
     if(visiting.has(branch.id))throw Error(id+': 분기 연결이 순환합니다.');
     visiting.add(branch.id);let parentPoints=n.points;
     if(branch.parent!==undefined){const parent=byId.get(branch.parent);if(!parent||parent===branch)throw Error(id+': 상위 분기를 확인하세요.');parentPoints=resolve(parent);}
     if(branch.from>=parentPoints.length)throw Error(id+': 분기 시작점을 확인하세요.');
     const source=parentPoints[branch.from];if(branch.points.length&&distance(branch.points[0],source)<.0009)throw Error(id+': 분기의 인접 지점을 같은 위치에 둘 수 없습니다.');
     const line=[source,...branch.points];visiting.delete(branch.id);cache.set(branch.id,line);return line;
    };
    n.branches.forEach(resolve);
    const resolvedIds=new Set(['main']);
    const canonicalTarget=(line,index,seen=new Set())=>{if(line==='main')return{line,index};if(seen.has(line))throw Error(id+': 분기 연결이 순환합니다.');seen.add(line);const owner=byId.get(line);if(!owner)throw Error(id+': 분기 연결 포인트를 확인하세요.');return index===0?canonicalTarget(owner.parent||'main',owner.from,seen):{line,index};};
    for(const branch of n.branches){
     if(branch.target){if(!resolvedIds.has(branch.target.line)||branch.target.line===branch.id)throw Error(id+': 분기 연결 대상은 이미 만들어진 경로의 포인트여야 합니다.');const targetLine=branch.target.line==='main'?n.points:resolve(byId.get(branch.target.line));if(branch.target.index>=targetLine.length)throw Error(id+': 분기 연결 포인트를 확인하세요.');const source=resolve(branch)[0],last=branch.points.at(-1)||source,target=targetLine[branch.target.index];if(samePoint(last,target))throw Error(id+': 연결 구간의 길이는 0보다 커야 합니다.');branch.target=canonicalTarget(branch.target.line,branch.target.index);}
     resolvedIds.add(branch.id);
    }
     if(n.points.length+n.branches.reduce((sum,b)=>sum+b.points.length,0)>100)throw Error(id+': 본선과 분기 지점은 합계 100개까지입니다.');
    }
    if(n.closed||(n.branches||[]).some(branch=>branch.target))validatePathTopology(n);
    if(o.segmentDirections!==undefined){
     if(!o.segmentDirections||typeof o.segmentDirections!=='object'||Array.isArray(o.segmentDirections))throw Error(id+': 구간 진행 방향을 확인하세요.');
     const lines=new Map(pathLines(n).map(line=>[line.id,line])),directions={};
     for(const [lineId,values] of Object.entries(o.segmentDirections)){const line=lines.get(lineId);if(!line||!Array.isArray(values)||values.length!==line.points.length-1||values.some(value=>!['forward','reverse'].includes(value)))throw Error(id+': '+lineId+' 구간 진행 방향을 확인하세요.');directions[lineId]=values.slice();}
     n.segmentDirections=directions;
    }
  }else{
   if(o.snapAnchor!==undefined){if(!axisKeys.includes(o.snapAnchor))throw Error(id+': 축 설정을 확인하세요.');n.snapAnchor=o.snapAnchor;}
   Object.assign(n,{x:number(o.x,id+' X',-200),y:number(o.y,id+' Y',-200),w:number(o.w,id+' 가로/길이',.001),h:number(o.h,id+' 세로/폭',.001),angle:number(o.angle??0,id+' 방향',-360,360)});
   if(o.kind==='W'){n.rackTypeId=typeof o.rackTypeId==='string'?o.rackTypeId:'';if(n.rackTypeId&&!typeIds.has(n.rackTypeId))throw new Error(id+': 랙타입을 찾을 수 없습니다.');n.bayGap=number(o.bayGap??0,'셀 폭 간격');n.rowGap=number(o.rowGap??0,'셀 깊이 간격');if(o.margin!==undefined)n.margin=number(o.margin,'마진');if(o.rackPreset!==undefined){const reference=o.rackPreset;if(!reference||typeof reference!=='object')throw Error(id+': 기준정보 타입 참조를 확인하세요.');n.rackPreset={id:code(reference.id,'기준정보 랙타입 코드'),w:number(reference.w,'기준 배치 가로',.001),h:number(reference.h,'기준 배치 세로',.001),bayGap:number(reference.bayGap,'기준 베이 간격'),rowGap:number(reference.rowGap,'기준 랙열 간격')};}}
   if(o.kind==='BT'){n.conveyorId=typeof o.conveyorId==='string'?o.conveyorId:'';n.offset=number(o.offset??0,'컨베이어 설치 거리',0,30000);}
  }
  const b=bounds(n);if(b.x<-.001||b.y<-.001||b.x+b.w>v.width+.001||b.y+b.h>v.height+.001)throw new Error(id+': 도면 경계를 벗어납니다. 위치·폭·방향을 확인하세요.');return n;
 });
 return{format:v.format,version:2,name:v.name.trim(),width:v.width,height:v.height,grid:v.grid,rackTypes,objects};
}
function rectPolygon(o,w=o.w,h=o.h){const a=(o.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),cx=o.x+o.w/2,cy=o.y+o.h/2;return[{x:o.x,y:o.y},{x:o.x+w,y:o.y},{x:o.x+w,y:o.y+h},{x:o.x,y:o.y+h}].map(p=>({x:cx+(p.x-cx)*c-(p.y-cy)*s,y:cy+(p.x-cx)*s+(p.y-cy)*c}));}
function pathLines(o){
 if(!o.points)return[];
 const branches=o.branches||[],byId=new Map(branches.map(branch=>[branch.id,branch])),cache=new Map(),visiting=new Set();
 const resolve=branch=>{if(cache.has(branch.id))return cache.get(branch.id);if(visiting.has(branch.id))throw Error('분기 연결이 순환합니다.');visiting.add(branch.id);const parent=branch.parent===undefined?null:byId.get(branch.parent);if(branch.parent!==undefined&&!parent)throw Error('상위 분기를 확인하세요.');const parentLine=parent?resolve(parent):{points:o.points,refs:o.points.map((_,index)=>({line:'main',index}))};if(branch.from<0||branch.from>=parentLine.points.length)throw Error('분기 시작점을 확인하세요.');const editPoints=[parentLine.points[branch.from],...branch.points],editRefs=[parentLine.refs[branch.from],...branch.points.map((_,index)=>({line:branch.id,index:index+1}))],points=editPoints.slice(),refs=editRefs.slice();if(branch.target){const targetLine=branch.target.line==='main'?{points:o.points,refs:o.points.map((_,index)=>({line:'main',index}))}:resolve(byId.get(branch.target.line));if(!targetLine||branch.target.index>=targetLine.points.length)throw Error('분기 연결 포인트를 확인하세요.');points.push(targetLine.points[branch.target.index]);refs.push(targetLine.refs[branch.target.index]);}const line={points,refs,editPoints,editRefs};visiting.delete(branch.id);cache.set(branch.id,line);return line;};
 const mainPoints=o.closed?[...o.points,o.points[0]]:o.points,mainRefs=mainPoints.map((_,index)=>({line:'main',index:index===o.points.length?0:index})),main={id:'main',points:mainPoints,refs:mainRefs,editPoints:o.points,editRefs:mainRefs.slice(0,o.points.length),labels:mainPoints.map((_,index)=>String(index===o.points.length?1:index+1)),closed:o.closed===true};
 return[main,...branches.map(branch=>{const line=resolve(branch),labels=line.points.map((_,index)=>index<line.editPoints.length?pointLabel(o,branch.id,index):pointLabel(o,line.refs[index].line,line.refs[index].index));return{id:branch.id,...line,labels,branch,parentId:branch.parent||'main',connected:!!branch.target};})];
}
function segmentDirection(o,lineId='main',index=0){const value=o?.segmentDirections?.[lineId]?.[index];return ['forward','reverse'].includes(value)?value:o?.flowDirection==='reverse'?'reverse':'forward';}
function pathPointRef(o,lineId,index){
 if(lineId==='main')return{points:o.points,index};
 const branch=(o.branches||[]).find(item=>item.id===lineId);if(!branch)throw Error('분기를 찾을 수 없습니다.');
 if(index>0)return{points:branch.points,index:index-1,branch};
 return pathPointRef(o,branch.parent||'main',branch.from);
}
function pathSegments(o){return pathLines(o).flatMap(line=>line.points.slice(1).map((point,index)=>({lineId:line.id,index,a:line.points[index],b:point,aRef:line.refs[index],bRef:line.refs[index+1]})));}
function orientation(a,b,c){const value=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);return Math.abs(value)<1e-8?0:Math.sign(value);}
function onSegment(a,b,p){return orientation(a,b,p)===0&&p.x>=Math.min(a.x,b.x)-1e-8&&p.x<=Math.max(a.x,b.x)+1e-8&&p.y>=Math.min(a.y,b.y)-1e-8&&p.y<=Math.max(a.y,b.y)+1e-8;}
function segmentConflict(first,second){
 const o1=orientation(first.a,first.b,second.a),o2=orientation(first.a,first.b,second.b),o3=orientation(second.a,second.b,first.a),o4=orientation(second.a,second.b,first.b),shared=[['a','a'],['a','b'],['b','a'],['b','b']].filter(([x,y])=>samePoint(first[x],second[y]));
 if(o1===0&&o2===0&&o3===0&&o4===0){const axis=Math.abs(first.a.x-first.b.x)>=Math.abs(first.a.y-first.b.y)?'x':'y',lo=Math.max(Math.min(first.a[axis],first.b[axis]),Math.min(second.a[axis],second.b[axis])),hi=Math.min(Math.max(first.a[axis],first.b[axis]),Math.max(second.a[axis],second.b[axis]));return hi-lo>1e-8||hi>=lo-1e-8&&!shared.some(([x,y])=>refKey(first[x+'Ref'])===refKey(second[y+'Ref']));}
 const intersects=o1*o2<=0&&o3*o4<=0&&(onSegment(first.a,first.b,second.a)||onSegment(first.a,first.b,second.b)||onSegment(second.a,second.b,first.a)||onSegment(second.a,second.b,first.b)||o1*o2<0&&o3*o4<0);
 if(!intersects)return false;
 return !shared.some(([x,y])=>refKey(first[x+'Ref'])===refKey(second[y+'Ref']));
}
function validatePathTopology(o){const segments=pathSegments(o);for(const segment of segments)if(samePoint(segment.a,segment.b))throw Error(o.id+': 길이가 0인 구간은 만들 수 없습니다.');for(let i=0;i<segments.length;i++)for(let j=0;j<i;j++)if(segmentConflict(segments[i],segments[j]))throw Error(o.id+': 경로 구간은 겹치거나 교차할 수 없습니다. 교차 지점의 포인트를 연결하세요.');return true;}
function connectionCycleSize(o,from,to,intermediateCount=0){const adjacency=new Map(),connect=(a,b)=>{const ak=refKey(a),bk=refKey(b);if(!adjacency.has(ak))adjacency.set(ak,new Set());if(!adjacency.has(bk))adjacency.set(bk,new Set());adjacency.get(ak).add(bk);adjacency.get(bk).add(ak);};for(const edge of pathSegments(o))connect(edge.aRef,edge.bRef);const start=refKey(from),goal=refKey(to),queue=[[start,0]],seen=new Set([start]);while(queue.length){const [key,length]=queue.shift();if(key===goal)return length+intermediateCount+1;for(const next of adjacency.get(key)||[])if(!seen.has(next)){seen.add(next);queue.push([next,length+1]);}}return 0;}
function pointLabel(o,lineId,index,seen=new Set()){
 if(lineId==='main')return String(index+1);
 if(seen.has(lineId))throw Error('분기 연결이 순환합니다.');seen.add(lineId);
 const branches=o.branches||[],branch=branches.find(item=>item.id===lineId);if(!branch)throw Error('분기를 찾을 수 없습니다.');
 const parentId=branch.parent||'main',source=pointLabel(o,parentId,branch.from,seen);if(index===0)return source;
 let offset=0;for(const sibling of branches){if(sibling===branch)break;if((sibling.parent||'main')===parentId&&sibling.from===branch.from)offset+=sibling.points.length;}
 return source+'-'+(offset+index);
}
function branchLabel(o,lineId){const branch=(o.branches||[]).find(item=>item.id===lineId);if(!branch)return'';const first=pointLabel(o,lineId,1),last=pointLabel(o,lineId,branch.points.length);return first===last?first:first+' ~ '+last;}
function polygons(o){
 if(!o.points)return[rectPolygon(o)];const h=o.width/2,parts=[];
 for(const line of pathLines(o)){const pts=line.points;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=distance(a,b);if(!len)continue;const ux=(b.x-a.x)/len,uy=(b.y-a.y)/len,nx=-uy*h,ny=ux*h,extend=o.cap==='legacy-square'?h:0,ax=a.x-ux*extend,ay=a.y-uy*extend,bx=b.x+ux*extend,by=b.y+uy*extend;parts.push([{x:ax+nx,y:ay+ny},{x:bx+nx,y:by+ny},{x:bx-nx,y:by-ny},{x:ax-nx,y:ay-ny}]);}if(o.cap!=='legacy-square'){const joints=line.closed?line.editPoints:line.branch?pts.slice(0,-1):pts.slice(1,-1);for(const p of joints)parts.push(Array.from({length:16},(_,i)=>({x:p.x+Math.cos(i*Math.PI/8)*h,y:p.y+Math.sin(i*Math.PI/8)*h})));}}
 return parts;
}
function bounds(o){const pts=polygons(o).flat(),x=Math.min(...pts.map(p=>p.x)),y=Math.min(...pts.map(p=>p.y));return{x,y,w:Math.max(...pts.map(p=>p.x))-x,h:Math.max(...pts.map(p=>p.y))-y};}
function polygonsOverlap(a,b){for(const poly of[a,b])for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],nx=q.y-p.y,ny=p.x-q.x,pa=a.map(v=>v.x*nx+v.y*ny),pb=b.map(v=>v.x*nx+v.y*ny);if(Math.max(...pa)<=Math.min(...pb)+1e-8||Math.max(...pb)<=Math.min(...pa)+1e-8)return false;}return true;}
const intersects=(a,b)=>a.x<b.x+b.w-1e-8&&a.x+a.w>b.x+1e-8&&a.y<b.y+b.h-1e-8&&a.y+a.h>b.y+1e-8;
function rackLayout(o,plan){const type=plan.rackTypes.find(t=>t.id===o.rackTypeId);if(!type)return null;const margin=o.margin||0,contentW=Math.max(0,o.w-margin),contentH=Math.max(0,o.h-margin),bays=Math.max(0,Math.floor((contentW+(o.bayGap||0)+1e-8)/(type.bayWidth+(o.bayGap||0)))),rows=Math.max(0,Math.floor((contentH+(o.rowGap||0)+1e-8)/(type.depth+(o.rowGap||0)))),actualW=bays?bays*type.bayWidth+(bays-1)*(o.bayGap||0):0,actualH=rows?rows*type.depth+(rows-1)*(o.rowGap||0):0;return{type,bays,rows,margin,actualW:round(actualW),actualH:round(actualH),remainingW:round(o.w-actualW),remainingH:round(o.h-actualH),floorCells:bays*rows*type.depthCount,totalCells:bays*rows*type.depthCount*type.levels};}
function fitRack(o,plan,bays,rows,preserveCenter=true){const type=plan.rackTypes.find(t=>t.id===o.rackTypeId);if(!type)throw Error('랙타입을 지정하세요.');if(!Number.isInteger(bays)||bays<1||!Number.isInteger(rows)||rows<1)throw Error('랙의 베이·랙열 수를 확인하세요.');const margin=number(o.margin??0,'마진'),w=round(bays*type.bayWidth+(bays-1)*(o.bayGap||0)+margin),h=round(rows*type.depth+(rows-1)*(o.rowGap||0)+margin);if(preserveCenter){o.x=round(o.x+(o.w-w)/2);o.y=round(o.y+(o.h-h)/2);}o.margin=margin;o.w=w;o.h=h;return o;}
function pathLength(o){const points=pathLines(o)[0].points;return points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0);}
function totalPathLength(o){return pathLines(o).reduce((total,line)=>total+line.points.slice(1).reduce((sum,p,i)=>sum+distance(p,line.points[i]),0),0);}
function atDistance(o,offset){let remaining=offset,points=pathLines(o)[0].points;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=distance(a,b);if(remaining<=length+1e-8){const t=Math.max(0,Math.min(1,remaining/length));return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,segment:i-1};}remaining-=length;}throw new Error('설치 거리가 컨베이어 전체 길이보다 큽니다.');}
function alignTunnel(o,plan){const cv=plan.objects.find(p=>p.id===o.conveyorId&&p.kind==='CV');if(!cv)throw new Error('연결할 컨베이어를 선택하세요.');const p=atDistance(cv,o.offset);o.x=round(p.x-o.w/2);o.y=round(p.y-o.h/2);o.angle=round(p.angle);}
function validate(plan){const issues=[],geometry=plan.objects.map(polygons),boxes=plan.objects.map(bounds);for(let i=0;i<plan.objects.length;i++){const a=plan.objects[i];for(let j=0;j<i;j++){const b=plan.objects[j];if(a.kind===b.kind&&pathKinds.includes(a.kind))continue;if([a.kind,b.kind].includes('BT')&&[a.kind,b.kind].includes('CV'))continue;if(intersects(boxes[i],boxes[j])&&geometry[i].some(p=>geometry[j].some(q=>polygonsOverlap(p,q))))issues.push({id:a.id,level:'error',message:a.id+' · '+b.id+' 배치 공간이 겹칩니다.'});}
 if(a.kind==='W'){const l=rackLayout(a,plan);if(!l)issues.push({id:a.id,level:'warning',message:a.id+': 랙타입을 지정하세요. 기존 배치 공간은 보존됩니다.'});else if(!l.bays||!l.rows)issues.push({id:a.id,level:'warning',message:a.id+': 선택한 랙타입의 셀이 들어갈 공간이 부족합니다.'});}
 if(a.kind==='BT'){const cv=plan.objects.find(o=>o.id===a.conveyorId&&o.kind==='CV');if(!cv)issues.push({id:a.id,level:'warning',message:a.id+': 연결할 컨베이어를 지정하세요.'});else{if(a.h<cv.width)issues.push({id:a.id,level:'warning',message:a.id+': 터널 폭이 컨베이어 폭보다 작습니다.'});try{const p=atDistance(cv,a.offset),angleDiff=Math.abs(((a.angle-p.angle+540)%360)-180);if(distance({x:a.x+a.w/2,y:a.y+a.h/2},p)>.003||angleDiff>.1)issues.push({id:a.id,level:'warning',message:a.id+': 컨베이어 기준 위치·방향이 다릅니다. 설치 위치 맞춤을 사용하세요.'});if(a.offset<a.w/2||a.offset+a.w/2>pathLength(cv))issues.push({id:a.id,level:'warning',message:a.id+': 터널 길이가 컨베이어 끝을 벗어납니다.'});}catch(e){issues.push({id:a.id,level:'warning',message:a.id+': '+e.message});}}}
 }return issues;}
function move(o,x,y,anchor='topLeft'){const b=bounds(o),old=anchor==='center'?{x:b.x+b.w/2,y:b.y+b.h/2}:b,dx=x-old.x,dy=y-old.y;if(o.points){o.points=o.points.map(p=>({x:round(p.x+dx),y:round(p.y+dy)}));if(o.branches)o.branches.forEach(branch=>branch.points=branch.points.map(p=>({x:round(p.x+dx),y:round(p.y+dy)})));}else{o.x=round(o.x+dx);o.y=round(o.y+dy);}}
function rotate(o,delta=90){if(!o.points){o.angle=round((((o.angle||0)+delta)%360+360)%360);return;}const b=bounds(o),cx=b.x+b.w/2,cy=b.y+b.h/2,a=delta*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),turn=p=>({x:round(cx+(p.x-cx)*cos-(p.y-cy)*sin),y:round(cy+(p.x-cx)*sin+(p.y-cy)*cos)});o.points=o.points.map(turn);if(o.branches)o.branches.forEach(branch=>branch.points=branch.points.map(turn));}
function unique(plan,kind){let i=1;while(plan.objects.some(o=>o.id===kind+String(i).padStart(2,'0')))i++;return kind+String(i).padStart(2,'0');}
function readFile(value){if(value?.format==='gics-floor-plan'){if(value.version!==1||!value.plan||Object.hasOwn(value,'documents'))throw Error('지원하지 않는 .gics 도면 파일입니다.');return read(value.plan);}return read(value);}
function serializeFile(plan){return JSON.stringify({format:'gics-floor-plan',version:1,plan:read(plan)},null,2);}
function fileName(plan){return (plan.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').trim()||'평면도')+'.gics';}
class History{constructor(plan){this.plan=read(plan);this.past=[];this.future=[];}commit(plan){const next=read(plan);if(JSON.stringify(next)===JSON.stringify(this.plan))return false;this.past.push(clone(this.plan));if(this.past.length>80)this.past.shift();this.plan=next;this.future=[];return true;}undo(){if(!this.past.length)return false;this.future.push(this.plan);this.plan=this.past.pop();return true;}redo(){if(!this.future.length)return false;this.past.push(this.plan);this.plan=this.future.pop();return true;}}
return{readFile,serializeFile,fileName,pathLines,pathSegments,pathPointRef,pointLabel,branchLabel,segmentDirection,totalPathLength,validatePathTopology,connectionCycleSize,axisKeys,axisPoint,moveAxis,roundMeters,formatMeters,presets:defaultTypes,validate,kinds,toolKinds,pathKinds,clone,round,snap,blank,sample,read,migrate,bounds,polygons,rectPolygon,polygonsOverlap,intersects,rackLayout,fitRack,pathLength,atDistance,alignTunnel,move,rotate,unique,History};
}));
