import * as T from 'three';
import {panels} from './geometry.js';

export const transformDefaults=()=>({space:'world',step:1,angle:15,magnet:true,gap:0});
export function normalizeTransformSettings(raw={}){const s={...transformDefaults(),...raw};if(!['world','local'].includes(s.space))throw Error('Choose world or part axes.');for(const [key,min,max] of [['step',0,1000],['angle',0,180],['gap',-1000,1000]])if(typeof s[key]!=='number'||!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(`${key==='step'?'Move step':key==='angle'?'Rotation step':'Contact gap'} must be ${min} to ${max}${key==='angle'?' degrees':' mm'}.`);s.magnet=!!s.magnet;return s;}
const rotation=rot=>new T.Quaternion().setFromEuler(new T.Euler(...rot.map(n=>n*Math.PI/180)));
function envelope(part,inverse){const q=rotation(part.rot),center=new T.Vector3(...part.pos).applyQuaternion(inverse),box=new T.Box3();for(let i=0;i<8;i++)box.expandByPoint(new T.Vector3(...part.dims.map((n,k)=>(i>>k&1?1:-1)*n/2)).applyQuaternion(q).add(new T.Vector3(...part.pos)).applyQuaternion(inverse));return {min:box.min.toArray(),max:box.max.toArray(),center:center.toArray()};}
// Project nominal envelopes onto the active gizmo basis. Only dragged axes move.
// Exact face orientation and offsets use the surface-placement tool instead.
export function snapPosition(part,targets,{axis='XYZ',space='world',threshold=2,gap=0}={}){
 const basis=space==='local'&&axis!=='XYZ'?rotation(part.rot):new T.Quaternion(),inverse=basis.clone().invert(),own=envelope(part,inverse),delta=[0,0,0],snaps=[];
 const candidates=targets.filter(t=>t.id!==part.id&&t.visible!==false&&t.kind!=='space').map(t=>({part:t,box:envelope(t,inverse)}));
 for(let i=0;i<3;i++){if(!axis.includes('XYZ'[i]))continue;let best=null;
  for(const {part:target,box} of candidates){
   const nearby=[0,1,2].filter(k=>k!==i).every(k=>own.min[k]<=box.max[k]+threshold&&own.max[k]>=box.min[k]-threshold);
   if(!nearby)continue;const matches=[['center',own.center[i],box.center[i]],['minimum edge',own.min[i],box.min[i]],['maximum edge',own.max[i],box.max[i]],['face + gap',own.max[i],box.min[i]-gap],['face + gap',own.min[i],box.max[i]+gap]];
   for(const [kind,source,destination] of matches){const change=destination-source,distance=Math.abs(change),separation=Math.hypot(...own.center.map((n,k)=>k===i?0:n-box.center[k]));if(distance>threshold)continue;const score=distance+separation*1e-7;if(!best||score<best.score)best={score,change,axis:'XYZ'[i],kind,target:target.id,name:target.name,source,destination,box};}
  }
  if(best){delta[i]=best.change;const a=[...own.center],b=[...best.box.center];a[i]=best.source+best.change;b[i]=best.kind==='face + gap'?best.destination+(best.source===own.max[i]?gap:-gap):best.destination;snaps.push({axis:best.axis,kind:best.kind,target:best.target,name:best.name,from:new T.Vector3(...a).applyQuaternion(basis).toArray(),to:new T.Vector3(...b).applyQuaternion(basis).toArray()});}
 }
 const pos=new T.Vector3(...part.pos).add(new T.Vector3(...delta).applyQuaternion(basis)).toArray();return {pos,snaps};
}
function clearGuide(s){if(!s.snapGuide)return;s.scene.remove(s.snapGuide);s.snapGuide.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});s.snapGuide=null;}
function showGuide(s,snaps){clearGuide(s);if(!snaps.length)return;const group=new T.Group();for(const id of new Set(snaps.map(a=>a.target))){const target=s.objects.get(id);if(!target)continue;const box=new T.Box3Helper(new T.Box3().setFromObject(target),'#168d76');box.material.depthTest=false;box.renderOrder=100;group.add(box);}for(const a of snaps){const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(...a.from),new T.Vector3(...a.to)]),new T.LineDashedMaterial({color:'#168d76',dashSize:3,gapSize:2,depthTest:false}));line.computeLineDistances();line.renderOrder=101;group.add(line);}s.snapGuide=group;s.scene.add(group);}
export function configureTransform(s,raw){s.transformSettings=normalizeTransformSettings(raw);const c=s.transformSettings;s.transform.setSpace(c.space);s.transform.setTranslationSnap(s.snapBypass?null:c.step||null);s.transform.setRotationSnap(s.snapBypass?null:c.angle*Math.PI/180||null);}
export function cancelTransform(s){if(!s.transformDraft)return false;const d=s.transformDraft;s.transformDraft=null;const o=s.objects.get(d.id);if(o){o.position.fromArray(d.pos);o.rotation.set(...d.rot.map(n=>n*Math.PI/180));}s.transform.dragging=false;s.transform.axis=null;s.orbit.enabled=true;clearGuide(s);s.updateSelection();s.events.transformPreview?.(d.id,d.pos,d.rot,[],true);s.render();setTimeout(()=>s.dragged=false,0);return true;}
export function bindTransformControls(s){
 configureTransform(s,transformDefaults());
 const bypass=value=>{if(s.snapBypass===value)return;s.snapBypass=value;configureTransform(s,s.transformSettings);};
 s.renderer.domElement.addEventListener('pointermove',e=>bypass(e.altKey),true);
 s.renderer.domElement.addEventListener('pointerdown',e=>bypass(e.altKey),true);
 s.renderer.domElement.addEventListener('pointercancel',()=>cancelTransform(s),true);
 s.renderer.domElement.addEventListener('lostpointercapture',()=>queueMicrotask(()=>{if(s.transformDraft)cancelTransform(s);}));
 window.addEventListener('keydown',e=>{if(e.key==='Alt')bypass(true);if(e.key==='Escape'&&cancelTransform(s)){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('keyup',e=>{if(e.key==='Alt')bypass(false);});window.addEventListener('blur',()=>{bypass(false);cancelTransform(s);});
 s.transform.addEventListener('dragging-changed',e=>{s.orbit.enabled=!e.value;});
 s.transform.addEventListener('mouseDown',()=>{const o=s.transform.object,p=s.project.parts.find(p=>p.id===s.selected);if(!o||!p)return;s.dragged=true;s.transformDraft={id:p.id,pos:o.position.toArray(),rot:[o.rotation.x,o.rotation.y,o.rotation.z].map(n=>n*180/Math.PI)};
  s.transformTargets=[...panels(s.project.enclosure),...s.project.parts].flatMap(p=>{const o=s.objects.get(p.id);return o?.visible&&p.id!==s.selected?[{...p,pos:o.position.toArray(),rot:[o.rotation.x,o.rotation.y,o.rotation.z].map(n=>n*180/Math.PI)}]:[];});
 });
 s.transform.addEventListener('objectChange',()=>{const o=s.transform.object,d=s.transformDraft;if(!o||!d)return;const part=s.project.parts.find(p=>p.id===d.id);if(!part)return;const rot=[o.rotation.x,o.rotation.y,o.rotation.z].map(n=>n*180/Math.PI);let snaps=[];
  if(s.transform.mode==='translate'&&s.transformSettings.magnet&&!s.snapBypass){const pixel=(s.camera.top-s.camera.bottom)/s.camera.zoom/Math.max(1,s.host.clientHeight),result=snapPosition({...part,pos:o.position.toArray(),rot},s.transformTargets,{...s.transformSettings,axis:s.transform.axis||'XYZ',threshold:Math.min(10,Math.max(.02,s.transformSettings.step*.51,pixel*8))});o.position.fromArray(result.pos);snaps=result.snaps;}
  showGuide(s,snaps);s.events.transformPreview?.(d.id,o.position.toArray(),rot,snaps);s.updateSelection();s.render();
 });
 s.transform.addEventListener('mouseUp',()=>{const d=s.transformDraft,o=s.transform.object;s.transformDraft=null;clearGuide(s);if(d&&o){const pos=o.position.toArray(),rot=[o.rotation.x,o.rotation.y,o.rotation.z].map(n=>n*180/Math.PI),changed=pos.some((n,i)=>Math.abs(n-d.pos[i])>1e-7)||rot.some((n,i)=>Math.abs(n-d.rot[i])>1e-7);if(changed)s.events.transformCommit?.(d.id,pos,rot);else s.events.transformPreview?.(d.id,d.pos,d.rot,[],true);}setTimeout(()=>s.dragged=false,0);s.render();});
 s.transform.addEventListener('change',()=>s.render());
}
