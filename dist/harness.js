import * as T from 'three';
const id=()=>crypto.randomUUID();
const text=(v,n=200)=>String(v??'').slice(0,n);
const number=(v,min,max,label,def=0)=>{v=v??def;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(label+' is outside the supported range.');return v;};
const vector=a=>{if(!Array.isArray(a)||a.length!==3)throw Error('Route coordinates need three values.');return a.map(v=>number(v,-10000,10000,'Route coordinate'));};
export function wireDetails(w){
 const conductors=w.conductors||[];if(!Array.isArray(conductors)||conductors.length>64)throw Error('A route supports up to 64 conductors.');const ids=new Set();
 return {harnessId:text(w.harnessId,100),sleeve:['none','braid','loom','ribbon'].includes(w.sleeve)?w.sleeve:'none',extraLength:number(w.extraLength,0,10000,'Additional service length'),startConnector:text(w.startConnector),endConnector:text(w.endConnector),conductors:conductors.map(c=>{const key=text(c.id,100)||id();if(ids.has(key))throw Error('Conductor IDs must be unique within a route.');ids.add(key);return {id:key,label:text(c.label)||'Conductor',color:/^#[0-9a-f]{6}$/i.test(c.color)?c.color:'#d98843',gauge:text(c.gauge,50),signal:text(c.signal),startPin:text(c.startPin,80),endPin:text(c.endPin,80)};})};
}
export function normalizeHarnesses(raw,p){
 const hs=raw.harnesses||[],lib=raw.harnessLibrary||[];if(!Array.isArray(hs)||hs.length>100||!Array.isArray(lib)||lib.length>50)throw Error('Limit to 100 harnesses and 50 reusable harness templates.');const ids=new Set();
 p.harnesses=hs.map(h=>{if(!h.id||ids.has(h.id))throw Error('Harness IDs must be unique.');ids.add(h.id);return {id:text(h.id,100),name:text(h.name)||'Harness',notes:text(h.notes,5000)};});
 for(const w of p.wires){Object.assign(w,wireDetails(w));if(w.harnessId&&!ids.has(w.harnessId))throw Error('Cable references a missing harness.');}
 p.harnessLibrary=lib.map(normalizeHarnessTemplate);const tids=new Set();for(const t of p.harnessLibrary){if(tids.has(t.id))throw Error('Harness template IDs must be unique.');tids.add(t.id);}return p;
}
export function pointWorld(p,pt){if(!pt.host)return new T.Vector3(...pt.pos);const part=p.parts.find(a=>a.id===pt.host);if(!part)throw Error('Route attachment missing.');return new T.Vector3(...pt.pos).applyEuler(new T.Euler(...part.rot.map(n=>n*Math.PI/180))).add(new T.Vector3(...part.pos));}
export function routeLength(p,w){const pts=w.points.map(pt=>pointWorld(p,pt));return pts.slice(1).reduce((s,v,i)=>s+v.distanceTo(pts[i]),0)*(1+w.slack/100)+(w.extraLength||0);}
export function captureHarness(p,harnessId,name){
 const h=p.harnesses.find(a=>a.id===harnessId),routes=p.wires.filter(w=>w.harnessId===harnessId);if(!h||!routes.length)throw Error('Add at least one route to the harness first.');const origin=pointWorld(p,routes[0].points[0]),hosts=[...new Set(routes.flatMap(w=>w.points.map(pt=>pt.host)).filter(Boolean))],ports=hosts.map((host,i)=>({id:'port-'+i,name:p.parts.find(a=>a.id===host).name}));
 return normalizeHarnessTemplate({id:id(),name:name||h.name,notes:h.notes,ports,routes:routes.map(w=>({...structuredClone(w),harnessId:'',points:w.points.map(pt=>({port:pt.host?ports[hosts.indexOf(pt.host)].id:'',local:[...pt.pos],pos:pointWorld(p,pt).sub(origin).toArray()}))}))});
}
export function normalizeHarnessTemplate(t){
 if(!t||!t.id||!Array.isArray(t.ports)||t.ports.length>500||!Array.isArray(t.routes)||!t.routes.length||t.routes.length>250)throw Error('Invalid harness template.');
 const ports=t.ports.map(a=>({id:text(a.id,100),name:text(a.name)})),ids=new Set(ports.map(a=>a.id));if(ids.size!==ports.length||ids.has(''))throw Error('Invalid harness ports.');
 return {id:text(t.id,100),name:text(t.name)||'Harness',notes:text(t.notes,5000),ports,routes:t.routes.map(w=>{if(!Array.isArray(w.points)||w.points.length<2||w.points.length>200)throw Error('Invalid template route.');return {...wireDetails(w),id:text(w.id,100),name:text(w.name),color:/^#[0-9a-f]{6}$/i.test(w.color)?w.color:'#d98843',diameter:number(w.diameter,.1,100,'Diameter',3),slack:number(w.slack,0,200,'Slack',10),zone:['AC','DC','Signal'].includes(w.zone)?w.zone:'Signal',points:w.points.map(pt=>{if(pt.port&&!ids.has(pt.port))throw Error('Missing harness port.');return {port:text(pt.port,100),pos:vector(pt.pos),local:vector(pt.local)};})};})};
}
export function insertHarness(p,template,bindings={},origin=[0,0,20]){
 const t=normalizeHarnessTemplate(template),h={id:id(),name:t.name,notes:t.notes};const routes=t.routes.map(w=>({...structuredClone(w),id:id(),harnessId:h.id,conductors:w.conductors.map(c=>({...c,id:id()})),points:w.points.map(pt=>{const binding=bindings[pt.port];if(binding){const [host,anchor]=binding.split('|'),part=p.parts.find(a=>a.id===host);if(!part)throw Error('Harness attachment is missing.');const a=anchor&&part.anchors.find(a=>a.id===anchor);if(anchor&&!a)throw Error('Harness reference point is missing.');return {host,pos:a?[...a.pos]:[...pt.local]};}return {host:'',pos:pt.pos.map((n,i)=>n+origin[i])};})}));
 if(p.wires.length+routes.length>250)throw Error('Maximum 250 routes.');p.harnesses.push(h);p.wires.push(...routes);return h;
}
export function harnessCSV(p){const quote=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const rows=[['Harness','Route','Conductor','Gauge / area','Color','Signal','From connector','From pin','To connector','To pin','Cut length mm','Sleeve','Allowance %','Extra mm']];for(const w of p.wires){const h=p.harnesses.find(h=>h.id===w.harnessId);for(const c of w.conductors?.length?w.conductors:[{}])rows.push([h?.name||'',w.name,c.label||'Unspecified conductor',c.gauge,c.color||w.color,c.signal,w.startConnector,c.startPin,w.endConnector,c.endPin,routeLength(p,w).toFixed(2),w.sleeve||'none',w.slack,w.extraLength||0]);}return rows.map(row=>row.map(quote).join(',')).join('\r\n');}
