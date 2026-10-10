import * as T from 'three';
import {panels,faceFrame,FACES} from './geometry.js';
import {evaluatePose,matrix} from './motion.js';

const clean=n=>+n.toFixed(6);
export const FACE_NAMES={top:'Top',bottom:'Bottom',front:'Front',back:'Back',left:'Left',right:'Right'};
const inside={'@Base':'top','@Lid':'bottom','@Left':'right','@Right':'left','@Front':'back','@Back':'front'};
export function surfaceName(panel,face,project){if(!panel.startsWith('@'))return `${project?.parts.find(p=>p.id===panel)?.name||'Component'} · ${FACE_NAMES[face]} face`;const outer=panels({w:1,d:1,h:1,t:.1}).find(p=>p.id===panel)?.face;return `${panel.slice(1)} · ${face===inside[panel]?'inside':face===outer?'outside':FACE_NAMES[face]+' edge'}`;}
export function surfaces(project,excludeId=null){return [...(project.enclosure.enabled?panels(project.enclosure):[]),...project.parts.filter(p=>p.id!==excludeId&&p.visible&&p.kind!=='space')].flatMap(p=>(p.id.startsWith('@')?[inside[p.id],p.face,...FACES.filter(f=>f!==inside[p.id]&&f!==p.face)]:FACES).map(face=>({panel:p.id,face,label:surfaceName(p.id,face,project)})));}
export function surfaceFrame(project,ref){
 const pose=evaluatePose(project),panel=[...pose.panelPoses,...pose.parts].find(p=>p.id===ref?.panel);
 if(!panel||!FACES.includes(ref.face))throw Error('Choose a component or enclosure face.');
 const f=faceFrame(panel.dims,ref.face),world=matrix(panel.pos,panel.rot).multiply(f.matrix);
 return {...f,world,panel:panel.id,face:ref.face,label:surfaceName(panel.id,ref.face,project)};
}
function mountRotation(part,ref,angle=0){
 const source=faceFrame(part.dims,ref.mount||'bottom').matrix.clone().setPosition(0,0,0);
 return new T.Matrix4().makeRotationZ(angle*Math.PI/180).multiply(new T.Matrix4().makeRotationX(Math.PI)).multiply(source.invert());
}
function extents(part,rotation){const e=rotation.elements;return [0,1,2].map(row=>part.dims.reduce((sum,d,col)=>sum+Math.abs(e[col*4+row])*d/2,0));}
export function placeOnSurface(part,frame,{u=0,v=0,gap=0,angle=0,mount='bottom'}={}){
 if(![u,v,gap,angle].every(Number.isFinite)||Math.max(Math.abs(u),Math.abs(v),Math.abs(gap))>10000||Math.abs(angle)>3600||!FACES.includes(mount))throw Error('Placement values are outside the supported range.');
 const local=mountRotation(part,{mount},angle),half=extents(part,local);
 const world=frame.world.clone().multiply(local.clone().setPosition(u,v,gap+half[2]));
 const pos=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();world.decompose(pos,q,scale);const e=new T.Euler().setFromQuaternion(q);
 return {pos:pos.toArray().map(clean),rot:[e.x,e.y,e.z].map(n=>clean(n*180/Math.PI)),surfaceRef:{panel:frame.panel,face:frame.face,mount},half,overhang:Math.abs(u)+half[0]>frame.span[0]/2+.001||Math.abs(v)+half[1]>frame.span[1]/2+.001};
}
// Read offsets from the actual body transform, so world moves and resizes cannot leave stale coordinates.
export function surfacePosition(project,part){
 if(!part.surfaceRef)return null;
 const frame=surfaceFrame(project,part.surfaceRef),local=frame.world.clone().invert().multiply(matrix(part.pos,part.rot));
 const rotation=local.clone().setPosition(0,0,0),base=mountRotation(part,part.surfaceRef),turn=rotation.clone().multiply(base.invert()),e=turn.elements;
 if(Math.abs(e[2])+Math.abs(e[6])+Math.abs(e[8])+Math.abs(e[9])+Math.abs(e[10]-1)>1e-4)return null;
 const half=extents(part,rotation),pos=new T.Vector3().setFromMatrixPosition(local);
 return {frame,u:clean(pos.x),v:clean(pos.y),gap:clean(pos.z-half[2]),angle:clean(Math.atan2(e[1],e[0])*180/Math.PI),mount:part.surfaceRef.mount||'bottom'};
}
export function snapSurface(part,frame,point,settings={}){
 const {step=1,free=false,angle=0,mount='bottom'}=settings;
 const local=new T.Vector3(...point).applyMatrix4(frame.world.clone().invert()),half=extents(part,mountRotation(part,{mount},angle));
 const result={u:local.x,v:local.y,snaps:[]};
 if(!free&&step>0)for(const [i,key] of ['u','v'].entries()){
  let n=Math.round(result[key]/step)*step;
  const edge=Math.max(0,frame.span[i]/2-half[i]),targets=[{n:0,label:key.toUpperCase()+' center'},...(half[i]<=frame.span[i]/2?[{n:-edge,label:key.toUpperCase()+' edge'},{n:edge,label:key.toUpperCase()+' edge'}]:[])];
  targets.sort((a,b)=>Math.abs(a.n-result[key])-Math.abs(b.n-result[key]));
  if(Math.abs(targets[0].n-result[key])<=Math.min(3,step*1.5)){n=targets[0].n;result.snaps.push(targets[0].label);}
  result[key]=n;
 }
 result.u=clean(result.u);result.v=clean(result.v);return result;
}
// Accept only nominal flat panel faces. Cutout walls, lettering and decals are not mounting planes.
export function surfaceHit(hit,root,panel){
 if(!hit.face||!hit.object.isMesh||hit.object.userData.decal)return null;
 const inverse=root.matrixWorld.clone().invert(),normal=hit.face.normal.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize().transformDirection(inverse);
 const values=normal.toArray(),axis=values.map(Math.abs).indexOf(Math.max(...values.map(Math.abs)));
 if(Math.abs(values[axis])<.9999)return null;
 const face=(values[axis]>0?['right','back','top']:['left','front','bottom'])[axis],local=hit.point.clone().applyMatrix4(inverse);
 if(Math.abs(local.getComponent(axis)-Math.sign(values[axis])*panel.dims[axis]/2)>.05)return null;
 return {panel:panel.id,face,point:hit.point.toArray()};
}
