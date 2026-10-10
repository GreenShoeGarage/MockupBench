import {drawingDefaults,normalizeDrawingOptions} from './drawing-options.js';
import {normalizeMotion} from './motion.js';
import {wireDetails,normalizeHarnesses} from './harness.js';
import {interfaceDefinitions} from './interface-catalog.js';
import {movieDefaults,normalizeMovieOptions} from './movie.js';
const text=(v,n=2000)=>typeof v==='string'?v.slice(0,n):'';
const finite=(v,min,max,label,def)=>{if(v===undefined&&def!==undefined)return def;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${label}: enter ${min}–${max}.`);return v;};
const vec=(v,n=3,label='Coordinates')=>{if(!Array.isArray(v)||v.length!==n)throw Error(label+' are incomplete.');return v.map(x=>finite(x,-10000,10000,label));};
export const featureDefaults=()=>({type:'cutout',face:'top',shape:'rectangle',u:0,v:0,w:20,h:12,angle:0,depth:2,through:true,radius:3,text:'LABEL',font:'sans',fontSize:8,spacing:1,align:'center',opacity:1,visible:true,color:'#f1e5be',points:[],contours:[],image:'',rows:1,cols:1,pitchU:25,pitchV:20});
export function normalizeFeature(f){
 const a={...featureDefaults()};for(const k of ['id','host','name','linkedPart'])a[k]=text(f[k],200);
 if(!a.id||!a.host)throw Error('A surface feature needs an ID and host.');
 for(const [k,opts] of Object.entries({type:['cutout','emboss','deboss','decal'],face:['top','bottom','front','back','left','right'],shape:['rectangle','roundrect','ellipse','slot','polygon','svg','text'],font:['sans','serif','mono'],align:['left','center','right']}))a[k]=opts.includes(f[k])?f[k]:a[k];
 for(const k of ['u','v','angle'])a[k]=finite(f[k],-10000,10000,k,a[k]);
 for(const k of ['w','h','depth','fontSize'])a[k]=finite(f[k],.01,5000,k,a[k]);
 for(const k of ['radius','pitchU','pitchV'])a[k]=finite(f[k],0,5000,k,a[k]);
 for(const k of ['rows','cols']){a[k]=finite(f[k],1,20,k,1);if(!Number.isInteger(a[k]))throw Error('Pattern counts must be whole numbers.');}
 if(a.rows*a.cols>100)throw Error('Limit patterns to 100 instances.');
 a.spacing=finite(f.spacing,.2,5,'Text spacing',1);a.opacity=finite(f.opacity,0,1,'Opacity',1);
 a.text=text(f.text,200)||'LABEL';a.color=/^#[0-9a-f]{6}$/i.test(f.color)?f.color:a.color;a.visible=f.visible!==false;a.through=f.through!==false;
 for(const k of ['points','contours'])if(f[k]){if(!Array.isArray(f[k]))throw Error('Invalid profile.');a[k]=k==='points'?f[k].slice(0,1000).map(p=>vec(p,2,'Profile point')):f[k].slice(0,300).map(c=>{if(!Array.isArray(c)||c.length>5000)throw Error('Profile is too complex.');return c.map(p=>vec(p,2,'Profile point'));});}
 if(f.image){if(typeof f.image!=='string'||f.image.length>12e6||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(f.image))throw Error('Decal image must be an embedded PNG/JPEG/WebP.');a.image=f.image;}
 return a;
}
export function extendPart(raw,p){
 if(raw.surfaceRef){const r=raw.surfaceRef;if(typeof r.panel!=='string'||!r.panel||r.panel.length>80||r.panel===p.id||!['top','bottom','front','back','left','right'].includes(r.face)||!['top','bottom','front','back','left','right'].includes(r.mount||'bottom'))throw Error('Invalid placement reference.');p.surfaceRef={panel:r.panel,face:r.face,mount:r.mount||'bottom'};}

 p.groupId=text(raw.groupId,100);p.supplier=['McMaster-Carr','DigiKey','Mouser','Other',''].includes(raw.supplier)?raw.supplier:'';p.supplierNumber=text(raw.supplierNumber,300);p.productURL=text(raw.productURL,1500);p.datasheet=text(raw.datasheet,1500);p.duty=finite(raw.duty,0,100,'Duty cycle',100);p.voltage=raw.voltage==null?null:finite(raw.voltage,0,10000,'Voltage');p.zone=['AC','DC','Battery','Passive','Service'].includes(raw.zone)?raw.zone:'Passive';p.intentionalWith=Array.isArray(raw.intentionalWith)?raw.intentionalWith.map(a=>text(a,100)).slice(0,500):[];
 p.anchors=Array.isArray(raw.anchors)?raw.anchors.slice(0,100).map(a=>({id:text(a.id,100),name:text(a.name,200),pos:vec(a.pos)})):[];
 p.profile=Array.isArray(raw.profile)?raw.profile.slice(0,1000).map(a=>vec(a,2)):[];p.catalogSource=text(raw.catalogSource,100);p.tags=Array.isArray(raw.tags)?raw.tags.slice(0,50).map(t=>text(t,100)):[];p.interfaceId=text(raw.interfaceId,100);if(p.kind==='interface'&&!interfaceDefinitions.some(d=>d.id===p.interfaceId))throw Error('Unknown InterfaceBench definition.');
 p.params={};if(raw.params){for(const key of ['teeth','turns','bore'])if(raw.params[key]!==undefined)p.params[key]=finite(raw.params[key],key==='bore'?.01:3,key==='bore'?.8:128,key);if((p.params.teeth&&!Number.isInteger(p.params.teeth))||(p.params.turns&&!Number.isInteger(p.params.turns)))throw Error('Tooth and turn counts must be whole numbers.');if(raw.params.shape)p.params.shape=['motor','gear','rack','rail','carriage','actuator','screw','nut','hinge','clevis','link','spring'].includes(raw.params.shape)?raw.params.shape:'';}return p;
}
export function extrasDefaults(){return {drawings:drawingDefaults(),movie:movieDefaults(),joints:[],couplings:[],harnesses:[],harnessLibrary:[],features:[],groups:[],wires:[],cameras:[],variants:[],library:[],currency:'USD',powerBudget:{batteryWh:20,usable:80,efficiency:90},dismissed:[],sequence:[]};}
export function extendProject(raw,p,{nested=false}={}){
 Object.assign(p,extrasDefaults());p.currency=/^[A-Z]{3}$/.test(raw.currency)?raw.currency:'USD';
 p.movie=normalizeMovieOptions(raw.movie||{});p.drawings=normalizeDrawingOptions(raw.drawings||{});
 p.features=(raw.features||[]).map(normalizeFeature);if(p.features.length>500)throw Error('Maximum 500 surface features.');
 p.groups=(raw.groups||[]).map(g=>({id:text(g.id,100),name:text(g.name,200)||'Assembly',parentId:text(g.parentId,100),origin:vec(g.origin||[0,0,0]),rot:vec(g.rot||[0,0,0]),templateId:text(g.templateId,100),revision:finite(g.revision,0,1e6,'Assembly revision',0)}));
 if(p.groups.length>250)throw Error('Maximum 250 assembly groups.');
 const ids=new Set(p.parts.map(a=>a.id));for(const g of p.groups){if(!g.id||ids.has(g.id))throw Error('Group IDs must be unique.');ids.add(g.id);}
 const groupIds=new Set(p.groups.map(g=>g.id));for(const g of p.groups){let current=g,seen=new Set();while(current?.parentId){if(seen.has(current.id))throw Error('Cyclic assembly nesting.');seen.add(current.id);current=p.groups.find(a=>a.id===current.parentId);if(!current)throw Error('Assembly parent is missing.');}}
 for(const a of p.parts)if(a.groupId&&!groupIds.has(a.groupId))a.groupId='';
 const hostIds=new Set(p.parts.map(a=>a.id));const panels=new Set(['@Base','@Left','@Right','@Front','@Back','@Lid']);for(const a of p.parts)if(a.surfaceRef&&!hostIds.has(a.surfaceRef.panel)&&!panels.has(a.surfaceRef.panel))throw Error('A placement reference targets a missing component.');for(const f of p.features){if(!hostIds.has(f.host)&&!panels.has(f.host))throw Error('A feature references a missing host.');if(ids.has(f.id))throw Error('Feature IDs must be unique.');ids.add(f.id);}
 p.wires=(raw.wires||[]).map(w=>({...wireDetails(w),id:text(w.id,100),name:text(w.name,200)||'Cable',color:/^#[a-f0-9]{6}$/i.test(w.color)?w.color:'#d68942',diameter:finite(w.diameter,.1,100,'Cable diameter',3),slack:finite(w.slack,0,200,'Cable slack',10),zone:['AC','DC','Signal'].includes(w.zone)?w.zone:'Signal',points:(w.points||[]).map(pt=>({host:text(pt.host,100),pos:vec(pt.pos)}))}));
 if(p.wires.length>250||p.wires.some(w=>w.points.length<2||w.points.length>200))throw Error('A cable needs 2–200 points; limit 250 cables.');
 for(const w of p.wires){if(!w.id||ids.has(w.id))throw Error('Cable IDs must be unique.');ids.add(w.id);}for(const w of p.wires)for(const pt of w.points)if(pt.host&&!p.parts.some(a=>a.id===pt.host))throw Error('Cable endpoint references a missing part.');
 normalizeHarnesses(raw,p);normalizeMotion(raw,p);
 p.cameras=(raw.cameras||[]).slice(0,30).map(c=>({id:text(c.id,100),name:text(c.name,100),position:vec(c.position),target:vec(c.target),zoom:finite(c.zoom,.001,1000,'Camera zoom',1),size:finite(c.size,1,100000,'View size',500),shell:['open','closed','ghost','none'].includes(c.shell)?c.shell:'open',explode:finite(c.explode,0,1,'Explode',0)}));
 for(const k of ['batteryWh','usable','efficiency'])p.powerBudget[k]=finite(raw.powerBudget?.[k],k==='batteryWh'?0:1,k==='batteryWh'?1e6:100,k,p.powerBudget[k]);
 p.dismissed=Array.isArray(raw.dismissed)?raw.dismissed.slice(0,2000).map(a=>text(a,500)):[];
 p.sequence=Array.isArray(raw.sequence)?raw.sequence.slice(0,100).map(s=>({id:text(s.id,100),name:text(s.name,200),notes:text(s.notes,5000),parts:(s.parts||[]).map(a=>text(a,100)).filter(id=>p.parts.some(a=>a.id===id))})):[];
 if(nested&&((raw.variants||[]).length||(raw.library||[]).length))throw Error('Nested library or variants are not supported.');
 return p;
}
