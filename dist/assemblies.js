import {pruneMotion,driven} from './motion.js';
import * as T from 'three';
import {uid,freshProject,validateProject,bounds} from './model.js';
export function groupIds(project,id){const out=new Set([id]);let changed=true;while(changed){changed=false;for(const g of project.groups)if(out.has(g.parentId)&&!out.has(g.id)){out.add(g.id);changed=true;}}return out;}
export function groupParts(project,id){const ids=groupIds(project,id);return project.parts.filter(p=>ids.has(p.groupId));}
export function assemblyBox(parts){const box=new T.Box3();for(const p of parts){const b=bounds(p);box.expandByPoint(new T.Vector3(...b.min));box.expandByPoint(new T.Vector3(...b.max));}return box;}
export function groupSelection(p,partIds,selectedGroups=[],name='Subassembly'){
 const group= {id:uid(),name,parentId:'',origin:[0,0,0],rot:[0,0,0],templateId:'',revision:0};
 const roots=selectedGroups.filter(id=>!selectedGroups.some(other=>other!==id&&groupIds(p,other).has(id)));
 const nestedParts=new Set(roots.flatMap(id=>groupParts(p,id).map(p=>p.id)));const parts=p.parts.filter(a=>partIds.includes(a.id)||nestedParts.has(a.id));if(!parts.length)throw Error('Select at least one component.');
 group.origin=assemblyBox(parts).getCenter(new T.Vector3()).toArray();p.groups.push(group);
 for(const a of parts)if(!nestedParts.has(a.id))a.groupId=group.id;for(const id of roots)p.groups.find(g=>g.id===id).parentId=group.id;return group;
}
export function moveGroup(project,id,origin,rot){
 const g=project.groups.find(g=>g.id===id);if(!g)throw Error('Assembly not found.');const parts=groupParts(project,id);if(parts.some(p=>p.locked))throw Error('Unlock all components in this assembly before transforming it.');
 const matrix=(pos,r)=>new T.Matrix4().compose(new T.Vector3(...pos),new T.Quaternion().setFromEuler(new T.Euler(...r.map(v=>v*Math.PI/180))),new T.Vector3(1,1,1));
 const delta=matrix(origin,rot).multiply(matrix(g.origin,g.rot).invert());
 for(const a of parts){const m=delta.clone().multiply(matrix(a.pos,a.rot)),pos=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();m.decompose(pos,q,scale);a.pos=pos.toArray();const e=new T.Euler().setFromQuaternion(q);a.rot=[e.x,e.y,e.z].map(n=>n*180/Math.PI);}
 const members=new Set(parts.map(a=>a.id));for(const w of project.wires){if(w.points[0].host&&w.points.at(-1).host&&w.points.every(pt=>!pt.host||members.has(pt.host)))for(const pt of w.points)if(!pt.host)pt.pos=new T.Vector3(...pt.pos).applyMatrix4(delta).toArray();}
 const descendants=groupIds(project,id);for(const child of project.groups.filter(a=>descendants.has(a.id))){const m=delta.clone().multiply(matrix(child.origin,child.rot)),pos=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();m.decompose(pos,q,scale);child.origin=pos.toArray();const e=new T.Euler().setFromQuaternion(q);child.rot=[e.x,e.y,e.z].map(n=>n*180/Math.PI);}
}
export function removeParts(project,ids){const dead=new Set(ids);project.parts=project.parts.filter(p=>!dead.has(p.id));for(const p of project.parts)if(dead.has(p.surfaceRef?.panel))delete p.surfaceRef;project.features=project.features.filter(f=>!dead.has(f.host));project.wires=project.wires.filter(w=>!w.points.some(pt=>dead.has(pt.host)));for(const s of project.sequence)s.parts=s.parts.filter(id=>!dead.has(id));pruneMotion(project);}
export function ungroup(p,id){const g=p.groups.find(a=>a.id===id);if(!g)return;for(const a of p.parts)if(a.groupId===id)a.groupId=g.parentId;for(const child of p.groups)if(child.parentId===id)child.parentId=g.parentId;p.groups=p.groups.filter(a=>a.id!==id);pruneMotion(p);}
export function captureAssembly(p,id,name){
 const g=p.groups.find(a=>a.id===id);if(!g)throw Error('Choose an assembly first.');const members=groupParts(p,id),ids=new Set(members.map(a=>a.id)),groups=groupIds(p,id),q=freshProject();q.enclosure.enabled=false;q.title=name||g.name;q.parts=structuredClone(members);q.groups=structuredClone(p.groups.filter(a=>groups.has(a.id)));q.groups.find(a=>a.id===id).parentId='';q.features=structuredClone(p.features.filter(a=>ids.has(a.host)));q.wires=structuredClone(p.wires.filter(w=>w.points[0].host&&w.points.at(-1).host&&w.points.every(pt=>!pt.host||ids.has(pt.host))));
 const bodies=new Set([...ids,...groups]);q.joints=structuredClone((p.joints||[]).filter(j=>bodies.has(j.parent)&&bodies.has(j.child)));const jointIds=new Set(q.joints.map(j=>j.id));q.couplings=structuredClone((p.couplings||[]).filter(c=>jointIds.has(c.driver)&&jointIds.has(c.follower)));const hs=new Set(q.wires.map(w=>w.harnessId));q.harnesses=structuredClone((p.harnesses||[]).filter(h=>hs.has(h.id)));
 for(const a of q.parts){a.locked=false;if(a.surfaceRef&&!ids.has(a.surfaceRef.panel))delete a.surfaceRef;}moveGroup(q,id,[0,0,0],[0,0,0]);return {id:uid(),name:name||g.name,revision:1,date:new Date().toISOString(),project:q};
}
export function insertAssembly(project,template,origin=[0,0,0],rot=[0,0,0],linked=true){
 const q=validateProject(template.project,{nested:true});const map=new Map([...q.parts,...q.groups,...q.features,...q.wires,...q.joints,...q.couplings,...q.harnesses].map(a=>[a.id,uid()]));
 for(const p of q.parts){p.id=map.get(p.id);p.groupId=map.get(p.groupId)||'';p.intentionalWith=p.intentionalWith.map(id=>map.get(id)||id);if(p.surfaceRef&&!p.surfaceRef.panel.startsWith('@'))p.surfaceRef.panel=map.get(p.surfaceRef.panel)||p.surfaceRef.panel;}
 for(const g of q.groups){g.id=map.get(g.id);g.parentId=map.get(g.parentId)||'';}
 for(const f of q.features){f.id=map.get(f.id);f.host=map.get(f.host)||f.host;f.linkedPart=map.get(f.linkedPart)||'';}
 for(const w of q.wires){w.id=map.get(w.id);w.harnessId=map.get(w.harnessId)||'';for(const pt of w.points)pt.host=map.get(pt.host)||'';}
 for(const h of q.harnesses)h.id=map.get(h.id);for(const j of q.joints){j.id=map.get(j.id);j.parent=map.get(j.parent)||'';j.child=map.get(j.child);}for(const c of q.couplings){c.id=map.get(c.id);c.driver=map.get(c.driver);c.follower=map.get(c.follower);}
 let root=q.groups.find(g=>!g.parentId);if(!root){root=groupSelection(q,q.parts.map(a=>a.id),[],template.name);}root.name=template.name;root.templateId=linked?template.id:'';root.revision=template.revision;moveGroup(q,root.id,origin,rot);
 if(project.parts.length+q.parts.length>500)throw Error('This assembly would exceed 500 components.');project.parts.push(...q.parts);project.groups.push(...q.groups);project.features.push(...q.features);project.wires.push(...q.wires);project.joints.push(...q.joints);project.couplings.push(...q.couplings);project.harnesses.push(...q.harnesses);return root;
}
export function updateInstance(p,id,template){const g=p.groups.find(a=>a.id===id);if(!g)return;const origin=[...g.origin],rot=[...g.rot],parentId=g.parentId;const ids=groupIds(p,id);removeParts(p,groupParts(p,id).map(a=>a.id));p.groups=p.groups.filter(a=>!ids.has(a.id));pruneMotion(p);const root=insertAssembly(p,template,origin,rot,true);root.parentId=parentId;return root;}
export function alignParts(p,ids,axis,mode,gap=0){
 const parts=ids.map(id=>p.parts.find(a=>a.id===id)).filter(Boolean);if(parts.length<2)throw Error('Select at least two components.');if(parts.some(a=>a.locked))throw Error('Unlock selected components first.');if(parts.some(a=>driven(p,a.id)))throw Error('Use joint controls to position driven components.');const i={x:0,y:1,z:2}[axis];const b=parts.map(bounds);
 if(mode==='distribute'){if(parts.length<3)throw Error('Select at least three components to distribute.');const sorted=[...parts].sort((a,b)=>a.pos[i]-b.pos[i]),step=(sorted.at(-1).pos[i]-sorted[0].pos[i])/(sorted.length-1);for(let n=1;n<sorted.length-1;n++)sorted[n].pos[i]=sorted[0].pos[i]+n*step;}
 else if(mode==='gap'){const sorted=[...parts].sort((a,b)=>bounds(a).min[i]-bounds(b).min[i]);for(let n=1;n<sorted.length;n++){const prev=bounds(sorted[n-1]),cur=bounds(sorted[n]);sorted[n].pos[i]+=prev.max[i]+gap-cur.min[i];}}
 else{const target=mode==='min'?b[0].min[i]:mode==='max'?b[0].max[i]:parts[0].pos[i];for(let n=1;n<parts.length;n++)parts[n].pos[i]+=target-(mode==='min'?b[n].min[i]:mode==='max'?b[n].max[i]:parts[n].pos[i]);}
}
export function worldPoint(p,pt){if(!pt.host)return new T.Vector3(...pt.pos);const host=p.parts.find(a=>a.id===pt.host);if(!host)throw Error('Missing cable host.');return new T.Vector3(...pt.pos).applyEuler(new T.Euler(...host.rot.map(a=>a*Math.PI/180))).add(new T.Vector3(...host.pos));}
export function cableLength(p,w){const points=w.points.map(pt=>worldPoint(p,pt));return points.slice(1).reduce((sum,point,i)=>sum+point.distanceTo(points[i]),0)*(1+w.slack/100)+(w.extraLength||0);}
export function powerEstimate(p){const loads=p.parts.filter(a=>a.loadW!==null),watts=loads.reduce((s,a)=>s+a.loadW*(a.duty??100)/100,0),unknown=p.parts.filter(a=>a.zone!=='Passive'&&a.zone!=='Service'&&a.loadW===null).length;const availableWh=p.powerBudget.batteryWh*p.powerBudget.usable/100*p.powerBudget.efficiency/100;return {watts,unknown,availableWh,hours:watts>0?availableWh/watts:null};}
export function measurePoints(points){const p=points.map(a=>new T.Vector3(...a));let length=0;for(let i=1;i<p.length;i++)length+=p[i].distanceTo(p[i-1]);let area=null,closedPerimeter=null;if(p.length>=3){const normal=new T.Vector3();for(let i=0;i<p.length;i++)normal.add(new T.Vector3().crossVectors(p[i],p[(i+1)%p.length]));const n=normal.clone().normalize();if(p.every(x=>Math.abs(new T.Vector3().subVectors(x,p[0]).dot(n))<.05)){area=normal.length()/2;closedPerimeter=length+p[0].distanceTo(p.at(-1));}}return {length,area,closedPerimeter,delta:p.length===2?p[1].clone().sub(p[0]).toArray():null};}
