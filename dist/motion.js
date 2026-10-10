import * as T from 'three';
import {panels} from './geometry.js';
export const JOINT_TYPES={fixed:'Fixed',revolute:'Revolute / hinge',slider:'Slider',screw:'Screw',cylindrical:'Cylindrical',ball:'Ball',planar:'Planar'};
export const jointAxes=type=>type==='fixed'?[]:type==='ball'?['Angle X (°)','Angle Y (°)','Angle Z (°)']:type==='planar'?['Travel U (mm)','Travel V (mm)','Angle (°)']:type==='cylindrical'?['Angle (°)','Travel (mm)']:[type==='slider'?'Travel (mm)':'Angle (°)'];
export function descendants(p,id){const s=new Set([id]);let old;do{old=s.size;for(const g of p.groups||[])if(s.has(g.parentId))s.add(g.id);}while(old!==s.size);return s;}
export function bodyMembers(p,id){if(!id)return [];const g=p.groups.find(g=>g.id===id);if(!g)return [id];const ids=descendants(p,id);return p.parts.filter(a=>ids.has(a.groupId)).map(a=>a.id);}
export function matrix(pos=[0,0,0],rot=[0,0,0]){return new T.Matrix4().compose(new T.Vector3(...pos),new T.Quaternion().setFromEuler(new T.Euler(...rot.map(x=>x*Math.PI/180))),new T.Vector3(1,1,1));}
function target(p,id){if(!id)return {pos:[0,0,0],rot:[0,0,0]};const a=p.parts.find(a=>a.id===id)||p.groups.find(g=>g.id===id)||p.panelPoses?.find(a=>a.id===id)||panels(p.enclosure).find(a=>a.id===id);if(!a)throw Error('Joint body is missing.');return {pos:a.pos||a.origin,rot:a.rot};}
export function bodyMatrix(p,id){const a=target(p,id);return matrix(a.pos,a.rot);}
export function createJoint(p,{id=crypto.randomUUID(),name='Joint',type='revolute',parent='',child,pivot,axis=[0,0,1],lead=2,limits,values=[0,0,0]}){
 const parentM=bodyMatrix(p,parent),childM=bodyMatrix(p,child);const center=pivot||new T.Vector3().setFromMatrixPosition(childM).toArray();
 return {id,name,type,parent,child,pivot:new T.Vector3(...center).applyMatrix4(parentM.clone().invert()).toArray(),axis:new T.Vector3(...axis).transformDirection(parentM.clone().invert()).toArray(),rest:parentM.invert().multiply(childM).toArray(),lead,values,limits:limits||Array.from({length:3},()=>({min:type==='slider'?-50:-90,max:type==='slider'?50:90}))};
}
const num=(n,min,max,label)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(label+' is outside the supported range.');return n;};
const vec=(a,n,label)=>{if(!Array.isArray(a)||a.length!==n)throw Error('Invalid '+label);return a.map(x=>num(x,-1e6,1e6,label));};
export function normalizeMotion(raw,p){
 if(!Array.isArray(raw.joints||[])||(raw.joints||[]).length>250||!Array.isArray(raw.couplings||[])||(raw.couplings||[]).length>250)throw Error('Limit motion to 250 joints and 250 couplings.');
 p.joints=(raw.joints||[]).map(j=>{
  if(!JOINT_TYPES[j.type])throw Error('Unknown joint type.');const axis=vec(j.axis,3,'joint axis');if(Math.hypot(...axis)<.00001)throw Error('Joint axis cannot be zero.');
  const limits=vecLimits(j.limits),values=vec(j.values,3,'joint values'),rest=vec(j.rest,16,'joint rest transform');const m=new T.Matrix4().fromArray(rest),sc=new T.Vector3();m.decompose(new T.Vector3(),new T.Quaternion(),sc);if(Math.abs(m.determinant()-1)>1e-5||sc.toArray().some(n=>Math.abs(n-1)>1e-5)||rest[3]!==0||rest[7]!==0||rest[11]!==0||rest[15]!==1)throw Error('Joint rest transform must be rigid.');
  return {id:String(j.id||'').slice(0,100),name:String(j.name||'Joint').slice(0,200),type:j.type,parent:String(j.parent||''),child:String(j.child||''),axis:new T.Vector3(...axis).normalize().toArray(),pivot:vec(j.pivot,3,'joint pivot'),rest,values,limits,lead:num(j.lead??2,-10000,10000,'Screw lead')};
 });
 p.couplings=(raw.couplings||[]).map(c=>{if(!['gear','rack'].includes(c.type))throw Error('Unknown coupling.');return {id:String(c.id||'').slice(0,100),name:String(c.name||'Coupling').slice(0,200),type:c.type,driver:String(c.driver),follower:String(c.follower),ratio:num(c.ratio??-1,-10000,10000,'Ratio'),pitchDiameter:num(c.pitchDiameter??20,.01,5000,'Pitch diameter'),offset:num(c.offset??0,-1e6,1e6,'Coupling offset')};});
 validateMotion(p);return p;
}
function vecLimits(list){if(!Array.isArray(list)||list.length!==3)throw Error('Joint needs three limit pairs.');return list.map(a=>{num(a.min,-1e6,1e6,'Minimum');num(a.max,-1e6,1e6,'Maximum');if(a.min>=a.max)throw Error('Joint maximum must exceed minimum.');return {min:a.min,max:a.max};});}
export function jointOrder(p){
 const joints=p.joints||[],sets=new Map(joints.map(j=>[j.id,new Set(bodyMembers(p,j.child))]));
 const pending=[...joints],order=[],done=new Set();while(pending.length){const i=pending.findIndex(j=>!j.parent||joints.every(other=>!bodyMembers(p,j.parent).some(id=>sets.get(other.id).has(id))||done.has(other.id)));if(i<0)throw Error('Joint hierarchy contains a cycle or a parent spans separately driven bodies.');const [j]=pending.splice(i,1);done.add(j.id);order.push(j);}return order;
}
export function coupledValues(p,overrides={}){
 const values=new Map((p.joints||[]).map(j=>[j.id,[...(overrides[j.id]||j.values)]]));const done=new Set(),pending=[...(p.couplings||[])];while(pending.length){const i=pending.findIndex(c=>!pending.some(other=>other.follower===c.driver));if(i<0)throw Error('Motion coupling cycle.');const [c]=pending.splice(i,1);if(done.has(c.follower))throw Error('A joint can only have one coupling driver.');done.add(c.follower);const a=values.get(c.driver),b=values.get(c.follower);if(!a||!b)throw Error('Coupling references a missing joint.');b[0]=c.offset+a[0]*c.ratio*(c.type==='rack'?Math.PI*c.pitchDiameter/360:1);}
 for(const j of p.joints||[])for(let i=0;i<jointAxes(j.type).length;i++){const n=values.get(j.id)[i];if(!Number.isFinite(n)||n<j.limits[i].min-1e-8||n>j.limits[i].max+1e-8)throw Error(j.name+': motion exceeds limit '+(i+1)+'.');}return values;
}
export function validateMotion(p){
 const ids=new Set([...p.parts,...p.groups,...p.features,...p.wires].map(a=>a.id));const occupied=new Set();for(const j of p.joints||[]){if(!j.id||ids.has(j.id))throw Error('Motion IDs must be unique.');ids.add(j.id);target(p,j.parent);target(p,j.child);if(!j.child)throw Error('Select a moving body.');const members=bodyMembers(p,j.child);if(!members.length)throw Error('Moving assembly is empty.');if(bodyMembers(p,j.parent).some(id=>members.includes(id)))throw Error('Fixed and moving bodies must not overlap.');for(const id of members){if(occupied.has(id))throw Error('A component cannot be driven by two joints. Use separate subassemblies for a mechanism chain.');occupied.add(id);}}
 for(const c of p.couplings||[]){if(!c.id||ids.has(c.id))throw Error('Motion IDs must be unique.');ids.add(c.id);const a=p.joints.find(j=>j.id===c.driver),b=p.joints.find(j=>j.id===c.follower);if(!a||!b||a.id===b.id)throw Error('Choose two different joints to couple.');if(!['revolute','screw','cylindrical'].includes(a.type)||!(c.type==='rack'?b.type==='slider':['revolute','screw','cylindrical'].includes(b.type)))throw Error('Gear coupling needs two rotary joints; rack coupling needs rotary driver and slider follower.');}
 jointOrder(p);coupledValues(p);
}
function poseInto(a,m){const pos=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();m.decompose(pos,q,s);const e=new T.Euler().setFromQuaternion(q);a[Array.isArray(a.origin)?'origin':'pos']=pos.toArray();a.rot=[e.x,e.y,e.z].map(x=>x*180/Math.PI);}
function motionMatrix(j,values){
 const axis=new T.Vector3(...j.axis).normalize(),pivot=new T.Vector3(...j.pivot);const move=new T.Matrix4(),rotation=new T.Matrix4();let distance=0;
 if(['revolute','screw','cylindrical'].includes(j.type))rotation.makeRotationAxis(axis,values[0]*Math.PI/180);
 if(j.type==='slider')distance=values[0];if(j.type==='screw')distance=values[0]*j.lead/360;if(j.type==='cylindrical')distance=values[1];
 if(j.type==='ball')rotation.makeRotationFromEuler(new T.Euler(...values.map(x=>x*Math.PI/180)));
 const delta=axis.clone().multiplyScalar(distance);
 if(j.type==='planar'){const u=new T.Vector3(Math.abs(axis.x)<.9?1:0,Math.abs(axis.x)<.9?0:1,0).projectOnPlane(axis).normalize(),v=new T.Vector3().crossVectors(axis,u);delta.copy(u).multiplyScalar(values[0]).addScaledVector(v,values[1]);rotation.makeRotationAxis(axis,values[2]*Math.PI/180);}
 move.makeTranslation(...delta.clone().add(pivot).toArray()).multiply(rotation).multiply(new T.Matrix4().makeTranslation(...pivot.clone().negate().toArray()));return move;
}
export function evaluatePose(project,overrides={}){
 const p={...project,parts:project.parts.map(a=>({...a,pos:[...a.pos],rot:[...a.rot]})),groups:project.groups.map(g=>({...g,origin:[...g.origin],rot:[...g.rot]})),wires:project.wires.map(w=>({...w,points:w.points.map(pt=>({...pt,pos:[...pt.pos]}))})),panelPoses:panels(project.enclosure)};
 const values=coupledValues(p,overrides);for(const j of jointOrder(p)){const current=bodyMatrix(p,j.child),next=bodyMatrix(p,j.parent).multiply(motionMatrix(j,values.get(j.id))).multiply(new T.Matrix4().fromArray(j.rest)),delta=next.multiply(current.invert()),members=new Set(bodyMembers(p,j.child));for(const a of [...p.parts,...p.panelPoses])if(members.has(a.id))poseInto(a,delta.clone().multiply(matrix(a.pos,a.rot)));if(p.groups.some(g=>g.id===j.child)){const gs=descendants(p,j.child);for(const g of p.groups)if(gs.has(g.id))poseInto(g,delta.clone().multiply(matrix(g.origin,g.rot)));}for(const w of p.wires)if(w.points[0].host&&w.points.at(-1).host&&w.points.every(pt=>!pt.host||members.has(pt.host)))for(const pt of w.points)if(!pt.host)pt.pos=new T.Vector3(...pt.pos).applyMatrix4(delta).toArray();}
 return p;
}
export function driven(p,id){const members=new Set(bodyMembers(p,id));return (p.joints||[]).some(j=>{const child=bodyMembers(p,j.child),parent=bodyMembers(p,j.parent);if(!child.some(x=>members.has(x)))return false;return !parent.length||!parent.every(x=>members.has(x))||!child.every(x=>members.has(x));});}
export function pruneMotion(p){const live=new Set(['',...p.parts.map(a=>a.id),...p.groups.map(g=>g.id),...panels(p.enclosure).map(a=>a.id)]);p.joints=(p.joints||[]).filter(j=>live.has(j.child)&&live.has(j.parent)&&bodyMembers(p,j.child).some(id=>live.has(id)));const ids=new Set(p.joints.map(j=>j.id));p.couplings=(p.couplings||[]).filter(c=>ids.has(c.driver)&&ids.has(c.follower));}
