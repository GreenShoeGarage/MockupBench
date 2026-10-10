import {closureDefaults,normalizeClosure} from './enclosure.js';
import {wireDetails} from './harness.js';
import {INTERFACE_CATALOG,MECHANICAL_CATALOG} from './components.js';
import {extendPart,extendProject,extrasDefaults,featureDefaults,normalizeFeature} from './schema.js';
export const VERSION='1.6.0-rc.1';
export const MAX_COORDS=4500000;
export const APP='MOCKUPBENCH';
export const uid=()=>globalThis.crypto?.randomUUID?.()||`p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const clone=x=>structuredClone(x);
export const MATERIALS={plastic:'Plastic',aluminum:'Aluminum',steel:'Steel',wood:'Wood',pcb:'PCB',rubber:'Rubber',glass:'Glass'};
// All catalogue entries are deliberately generic, illustrative envelopes in millimetres.
const entries=[
 ['pcb','Custom PCB','Electronics','pcb',[80,60,12],'#286c51','pcb','custom'],
 ['controller','Controller board','Electronics','pcb',[70,55,18],'#2e7669','pcb','cots'],
 ['sbc','Single-board computer','Electronics','pcb',[85,56,20],'#468151','pcb','cots'],
 ['module','Sensor / radio module','Electronics','pcb',[35,25,8],'#315781','pcb','cots'],
 ['display','Display module','Electronics','display',[95,60,12],'#30393c','plastic','cots'],
 ['relay','Relay module','Electronics','block',[50,40,22],'#467b9b','plastic','cots'],
 ['terminal','Terminal block','Electronics','block',[30,10,12],'#478b62','plastic','cots'],
 ['speaker','Speaker','Electronics','cylinder',[50,50,20],'#323a40','steel','cots'],
 ['battery','Battery pack','Power','battery',[70,40,20],'#e29d42','plastic','cots'],
 ['cell','Cylindrical battery','Power','cylinder',[19,19,67],'#bc6a50','steel','cots'],
 ['holder','Battery holder','Power','block',[80,45,25],'#343a42','plastic','cots'],
 ['psu','AC–DC power supply','Power','psu',[100,60,35],'#a5adaf','aluminum','cots'],
 ['dc','DC–DC converter','Power','pcb',[45,25,15],'#327093','pcb','cots'],
 ['inlet','AC inlet envelope','Power','block',[45,30,30],'#30373d','plastic','cots'],
 ['jack','DC jack envelope','Power','cylinder',[12,12,18],'#3b4346','plastic','cots'],
 ['fuse','Fuse holder','Power','cylinder',[15,15,30],'#323a40','plastic','cots'],
 ['motor','DC motor','Mechanical','motor',[32,32,50],'#a0a9aa','steel','cots'],
 ['servo','Servo motor','Mechanical','block',[40,20,40],'#365d85','plastic','cots'],
 ['stepper','Stepper motor','Mechanical','block',[42,42,48],'#475052','steel','cots'],
 ['fan','Cooling fan','Mechanical','fan',[60,60,15],'#434b4c','plastic','cots'],
 ['bearing','Bearing / spacer','Mechanical','cylinder',[22,22,7],'#929d9e','steel','cots'],
 ['standoff','Standoff','Mechanical','cylinder',[6,6,15],'#c69d50','steel','cots'],
 ['fastener','Fastener envelope','Mechanical','cylinder',[6,6,20],'#a9b0b2','steel','cots'],
 ['knob','Control knob','Interface','cylinder',[25,25,16],'#52696e','plastic','cots'],
 ['switch','Panel switch','Interface','block',[22,15,28],'#d77b48','plastic','cots'],
 ['led','Indicator light','Interface','cylinder',[8,8,12],'#91b771','glass','cots'],
 ['connector','Panel connector','Interface','block',[30,15,20],'#a5afb2','steel','cots'],
 ['wood','Wood panel','Custom','block',[180,100,12],'#bd8d5b','wood','custom'],
 ['metal','Metal plate','Custom','block',[160,100,3],'#a8b4b9','aluminum','custom'],
 ['bracket','Angle bracket','Custom','bracket',[40,40,40],'#aab4b5','aluminum','custom'],
 ['block','Custom block','Custom','block',[50,50,30],'#6b9c98','plastic','custom'],
 ['rod','Rod / dowel','Custom','cylinder',[12,12,100],'#ba9467','wood','custom'],
 ['space','Service clearance','Custom','space',[60,40,30],'#d69946','plastic','custom']
];
export const CATALOG=[...entries.map(([key,name,category,kind,dims,color,material,origin])=>({key,name,category,kind,dims,color,material,origin})),...MECHANICAL_CATALOG,...INTERFACE_CATALOG];
export function makePart(key,override={}){
 const base=CATALOG.find(p=>p.key===key)||CATALOG[0];
 return {catalogSource:'',tags:[],interfaceId:'',params:{},...clone(base),id:uid(),pos:[0,0,base.dims[2]/2+8],rot:[0,0,0],visible:true,locked:false,confidence:'placeholder',manufacturer:base.manufacturer||'',partNumber:base.partNumber||'',source:base.source||'',notes:base.notes||'',cost:null,loadW:null,groupId:'',supplier:'',supplierNumber:'',productURL:'',datasheet:'',duty:100,voltage:null,zone:'Passive',intentionalWith:[],anchors:clone(base.anchors||[]),profile:[],...override};
}
export function freshProject(){return {app:APP,schema:5,version:VERSION,title:'Untitled product',client:'',units:'mm',power:'Battery',enclosure:{enabled:true,w:300,d:220,h:110,t:6,material:'wood',color:'#bc9064',closure:closureDefaults()},parts:[],assumptions:'',evidence:'',notes:'',baseline:null,...extrasDefaults()};}
export function demoProject(){let p=freshProject();p.title='Portable field console';p.client='Concept study · example';p.notes='A portable controller with a timber enclosure, removable lid, battery pack and a custom mounting plate.';p.assumptions='All sample dimensions are illustrative. Confirm supplier drawings and allow space for wiring, connectors, tools and cooling.';p.parts=[
 makePart('metal',{name:'Electronics mounting plate',dims:[160,130,3],pos:[-43,0,14]}),
 makePart('controller',{pos:[-58,-23,31]}),makePart('module',{pos:[-82,34,27]}),makePart('terminal',{pos:[-20,43,24]}),
 makePart('battery',{pos:[87,-35,25]}),makePart('dc',{pos:[74,40,25]}),
 makePart('display',{pos:[-52,-8,99]}),makePart('knob',{pos:[50,-8,100]}),makePart('switch',{pos:[86,25,89]}),
 makePart('standoff',{pos:[-111,-48,23]}),makePart('standoff',{pos:[23,48,23]})
 ];
 const group={id:uid(),name:'Controller subassembly',parentId:'',origin:[-43,0,23],rot:[0,0,0],templateId:'',revision:0};p.groups=[group];for(const i of [0,1,2,3,9,10])p.parts[i].groupId=group.id;
 p.parts[1].loadW=3;p.parts[1].zone='DC';p.parts[2].loadW=.5;p.parts[2].zone='DC';p.parts[4].zone='Battery';p.parts[4].loadW=0;p.parts[6].loadW=2;p.parts[6].zone='DC';p.parts[6].pos[2]=110;p.parts[7].pos[2]=114;
 p.parts[1].anchors=[{id:uid(),name:'Mount A',pos:[-30,-22,-9]},{id:uid(),name:'Mount B',pos:[30,22,-9]}];
 p.features=[normalizeFeature({...featureDefaults(),id:uid(),host:'@Lid',name:'Display window',shape:'roundrect',u:-52,v:-8,w:85,h:50,radius:3}),normalizeFeature({...featureDefaults(),id:uid(),host:'@Lid',name:'Control opening',shape:'ellipse',u:50,v:-8,w:12,h:12}),normalizeFeature({...featureDefaults(),id:uid(),host:'@Lid',name:'Field console label',type:'deboss',text:'FIELD CONSOLE',u:0,v:76,fontSize:9,depth:1})];
 p.wires=[{...wireDetails({}),id:uid(),name:'Controller harness',color:'#d98843',diameter:2.5,slack:15,zone:'DC',points:[{host:p.parts[1].id,pos:[20,0,0]},{host:'',pos:[-30,20,32]},{host:p.parts[3].id,pos:[0,0,0]}]}];return p;}
const str=(v,n=1000)=>typeof v==='string'?v.slice(0,n):'';
const number=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${label} must be between ${min} and ${max}.`);return v;};
const color=v=>/^#[a-f\d]{6}$/i.test(v)?v:'#78918b';
export function validateProject(raw,{nested=false}={}){
 if(!raw||raw.app!==APP||![1,2,3,4,5].includes(raw.schema))throw Error('Use a MOCKUPBENCH schema 1, 2, 3, 4 or 5 project JSON file.');
 if(!Array.isArray(raw.parts)||raw.parts.length>500)throw Error('A project can contain up to 500 parts.');
 const p=freshProject();for(const key of ['title','client','assumptions','evidence','notes'])p[key]=str(raw[key],key==='title'?160:12000);
 p.units=raw.units==='in'?'in':'mm';p.power=['Battery','AC mains','External DC','Battery + AC','Unspecified'].includes(raw.power)?raw.power:'Unspecified';
 const e=raw.enclosure;if(!e)throw Error('Missing enclosure dimensions.');
 p.enclosure={enabled:e.enabled!==false,w:number(e.w,5,914.4,'Width'),d:number(e.d,5,914.4,'Depth'),h:number(e.h,5,914.4,'Height'),t:number(e.t,.1,100,'Wall thickness'),material:MATERIALS[e.material]?e.material:'plastic',color:color(e.color)};
 if(e.t*2>=Math.min(e.w,e.d,e.h))throw Error('Enclosure thickness must be less than half its smallest dimension.');
 p.enclosure.closure=normalizeClosure(e.closure,p.enclosure);
 let vertexCount=0;const ids=new Set();
 p.parts=raw.parts.map((a,i)=>{
  if(!a||!Array.isArray(a.dims)||a.dims.length!==3||!Array.isArray(a.pos)||a.pos.length!==3||!Array.isArray(a.rot)||a.rot.length!==3)throw Error(`Part ${i+1} has incomplete geometry.`);
  const b=makePart(a.key);b.id=str(a.id,80)||uid();if(ids.has(b.id))throw Error('Part IDs must be unique.');ids.add(b.id);
  b.kind=['block','pcb','display','cylinder','battery','psu','motor','fan','bracket','space','mesh','mechanism','interface'].includes(a.kind)?a.kind:'block';
  if(b.kind==='mesh')b.category='Imported';
  b.dims=a.dims.map(n=>number(n,.01,5000,'Part size'));b.pos=a.pos.map(n=>number(n,-10000,10000,'Part position'));b.rot=a.rot.map(n=>number(n,-3600,3600,'Part rotation'));
  for(const k of ['name','manufacturer','partNumber','source','notes'])b[k]=str(a[k],k==='notes'?5000:500);
  b.name=b.name||'Unnamed part';b.color=color(a.color);b.material=MATERIALS[a.material]?a.material:'plastic';b.origin=a.origin==='custom'?'custom':'cots';
  b.confidence=['placeholder','datasheet','measured'].includes(a.confidence)?a.confidence:'placeholder';b.visible=a.visible!==false;b.locked=!!a.locked;
  b.cost=a.cost==null?null:number(a.cost,0,1e8,'Unit cost');b.loadW=a.loadW==null?null:number(a.loadW,0,1e6,'Load watts');
  if(b.kind==='mesh'){
   if(!Array.isArray(a.vertices)||a.vertices.length<9||a.vertices.length%9!==0)throw Error('Imported mesh has invalid triangles.');
   vertexCount+=a.vertices.length;if(vertexCount>MAX_COORDS)throw Error('Project mesh limit is 500,000 triangles.');
   b.vertices=a.vertices.map(n=>number(n,-1,1,'Normalized mesh coordinate'));
  }
  return extendPart(a,b);
 });
 if(raw.baseline&&typeof raw.baseline==='object'){
  if(!Array.isArray(raw.baseline.parts)||raw.baseline.parts.length>500)throw Error('Invalid baseline.');
  p.baseline={name:str(raw.baseline.name,160),date:str(raw.baseline.date,80),enclosure:raw.baseline.enclosure,extras:raw.baseline.extras?str(raw.baseline.extras,200):'',parts:raw.baseline.parts.map(a=>({id:str(a.id,80),name:str(a.name,500),signature:str(a.signature,12000)}))};
 }
 extendProject(raw,p,{nested});
 if(!nested){for(const key of ['library','variants']){const list=raw[key]||[];if(!Array.isArray(list)||list.length>(key==='library'?30:10))throw Error('Too many '+key+' records.');p[key]=list.map(a=>({id:str(a.id,100),name:str(a.name,200),revision:a.revision||1,date:str(a.date,100),project:validateProject(a.project,{nested:true})}));}}
 return p;
}
// Euler XYZ, matching THREE.Euler. Coordinates are X width, Y depth, Z height.
export function rotatedHalf(dims,rot){
 const [a,b,c]=rot.map(n=>n*Math.PI/180), A=Math.cos(a),B=Math.sin(a),C=Math.cos(b),D=Math.sin(b),E=Math.cos(c),F=Math.sin(c);
 const m=[[C*E,-C*F,D],[A*F+B*D*E,A*E-B*D*F,-B*C],[B*F-A*D*E,B*E+A*D*F,A*C]];
 return m.map(row=>row.reduce((s,n,i)=>s+Math.abs(n)*dims[i]/2,0));
}
export function bounds(part){const h=rotatedHalf(part.dims,part.rot);return {min:part.pos.map((n,i)=>n-h[i]),max:part.pos.map((n,i)=>n+h[i])};}
export function inspect(p){
 const findings=[],e=p.enclosure,parts=p.parts.filter(p=>p.kind!=='space'),margin=.2;
 if(e.enabled){const low=[-e.w/2+e.t,-e.d/2+e.t,e.t],high=[e.w/2-e.t,e.d/2-e.t,e.h-(e.closure?.type==='slide'?2:1)*e.t];
  for(const part of parts){const b=bounds(part);if(b.min.some((n,i)=>n<low[i]-margin)||b.max.some((n,i)=>n>high[i]+margin))findings.push({severity:'Review',confidence:'Conservative',ids:[part.id],text:`${part.name}: extends into or beyond the enclosure walls. Panel-mounted parts may do this intentionally.`});}
 }
 for(let i=0;i<p.parts.length;i++)for(let j=i+1;j<p.parts.length;j++){
  const a=p.parts[i],b=p.parts[j];if(a.kind==='space'&&b.kind==='space')continue;
  const aa=bounds(a),bb=bounds(b);if([0,1,2].every(k=>Math.min(aa.max[k],bb.max[k])-Math.max(aa.min[k],bb.min[k])>margin))findings.push({severity:'Review',confidence:'Conservative',ids:[a.id,b.id],text:`${a.name} / ${b.name}: ${a.kind==='space'||b.kind==='space'?'clearance volume occupied':'bounding envelopes overlap'}.`});
 }
 const unverified=parts.filter(a=>a.confidence==='placeholder').length;
 if(unverified)findings.push({severity:'Note',confidence:'Recorded',ids:[],text:`${unverified} part${unverified===1?'':'s'} use unverified placeholder dimensions.`});
 return findings;
}
export function bom(p){const map=new Map();for(const part of p.parts.filter(a=>a.kind!=='space')){const key=JSON.stringify([part.name,part.partNumber,part.manufacturer,part.dims,part.material,part.origin,part.cost,part.confidence,part.supplier,part.supplierNumber,part.productURL,part.params,part.interfaceId,part.profile,part.vertices?fingerprint(part.vertices):'',p.features.filter(f=>f.host===part.id).map(({id,host,...f})=>f)]);if(!map.has(key))map.set(key,{...part,quantity:0});map.get(key).quantity++;}return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));}
export function fingerprint(value){const text=JSON.stringify(value);let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return (a>>>0).toString(16)+(b>>>0).toString(16);}
export const signature=p=>fingerprint(p);
const legacySignature=p=>JSON.stringify([p.name,p.kind,p.dims,p.pos,p.rot,p.material,p.color,p.partNumber,p.manufacturer,p.cost,p.source,p.notes,p.confidence,p.loadW,p.vertices?[p.vertices.length,...p.vertices.slice(0,9)]:undefined]);
const extraSignature=p=>fingerprint([p.features,p.groups,p.wires,p.powerBudget,p.sequence,p.joints,p.couplings,p.harnesses,p.harnessLibrary]);
export function baseline(p,name){p.baseline={name:name||'Design baseline',date:new Date().toISOString(),enclosure:clone(p.enclosure),extras:extraSignature(p),parts:p.parts.map(a=>({id:a.id,name:a.name,signature:signature(a)}))};}
export function comparison(p){if(!p.baseline)return [];const old=new Map(p.baseline.parts.map(a=>[a.id,a]));const out=[];for(const a of p.parts){let b=old.get(a.id);if(!b)out.push(`Added: ${a.name}`);else if(b.signature!==(b.signature.startsWith('[')?legacySignature(a):signature(a)))out.push(`Changed: ${a.name}`);old.delete(a.id);}for(const a of old.values())out.push(`Removed: ${a.name}`);if(JSON.stringify(p.enclosure)!==JSON.stringify(p.baseline.enclosure))out.push('Enclosure changed');if(p.baseline.extras&&extraSignature(p)!==p.baseline.extras)out.push('Surface features, assemblies, wiring, motion, power assumptions or sequence changed');return out;}
export const csvCell=x=>'"'+String(x??'').replace(/^[\u0000-\u0020]*[=+@\-]/,'\'$&').replaceAll('"','""')+'"';
export function bomCSV(p){return [['Part','Quantity','Origin','Manufacturer','Part number','Width (mm)','Depth (mm)','Height (mm)','Material','Unit cost (project currency)','Dimension basis','Source','Supplier','Supplier number','Product URL','Datasheet URL','Load W','Duty percent','Power zone'],...bom(p).map(a=>[a.name,a.quantity,a.origin,a.manufacturer,a.partNumber,...a.dims,a.material,a.cost,a.confidence,a.source,a.supplier,a.supplierNumber,a.productURL,a.datasheet,a.loadW,a.duty,a.zone])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
