import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {freshProject,makePart,validateProject} from '../dist/model.js';
import {FACES,panels,faceFrame,initGeometry} from '../dist/geometry.js';
import {matrix,createJoint} from '../dist/motion.js';
import {featureDefaults,normalizeFeature} from '../dist/schema.js';
import {enclosureObject,partObject,Studio} from '../dist/scene.js';
import {surfaces,surfaceFrame,placeOnSurface,surfacePosition,snapSurface,surfaceHit} from '../dist/placement.js';
const near=(a,b,e=2e-5)=>assert.ok(Math.abs(a-b)<e,`${a} differs from ${b}`);
test('every enclosure face and each component mounting face aligns flush with exact offsets',()=>{
 const p=freshProject(),part=makePart('block',{dims:[40,25,12]});assert.equal(surfaces(p).length,36);
 for(const ref of surfaces(p))for(const mount of FACES){
  const f=surfaceFrame(p,ref),values={u:11.125,v:-7.375,gap:2.5,angle:37,mount},pose=placeOnSurface(part,f,values),m=matrix(pose.pos,pose.rot);
  const source=faceFrame(part.dims,mount),center=new T.Vector3(...source.origin).applyMatrix4(m).applyMatrix4(f.world.clone().invert());
  near(center.x,values.u);near(center.y,values.v);near(center.z,values.gap);
  const normal=new T.Vector3(...source.n).transformDirection(m),target=new T.Vector3(0,0,1).transformDirection(f.world);near(normal.dot(target),-1);
  const back=surfacePosition(p,{...part,...pose});for(const k of ['u','v','gap','angle'])near(back[k],values[k]);
 }
});
test('surface frames follow saved panel poses and references round trip without stale offsets',()=>{
 const p=freshProject(),part=makePart('display');p.joints=[createJoint(p,{child:'@Lid',axis:[1,0,0],pivot:[0,100,100],values:[65,0,0],limits:[{min:-90,max:90},{min:-90,max:90},{min:-90,max:90}]})];
 const f=surfaceFrame(p,{panel:'@Lid',face:'bottom'}),pose=placeOnSurface(part,f,{u:21,v:-9,gap:4});Object.assign(part,pose);p.parts.push(part);
 const saved=validateProject(JSON.parse(JSON.stringify(p))),loaded=surfacePosition(saved,saved.parts[0]);near(loaded.u,21);near(loaded.v,-9);near(loaded.gap,4);
 const shift=new T.Vector3(5,0,0).transformDirection(f.world).multiplyScalar(5);part.pos=part.pos.map((n,i)=>n+shift.getComponent(i));near(surfacePosition(p,part).u,26);
 part.rot[1]+=17;assert.equal(surfacePosition(p,part),null);
 assert.throws(()=>validateProject({...p,parts:[{...part,surfaceRef:{panel:'oops',face:'top'}}]}),/placement reference/);
});
test('snapping uses face axes and rotated extents; free motion and overhang remain explicit',()=>{
 const p=freshProject(),part=makePart('block',{dims:[40,20,10]}),frame=surfaceFrame(p,{panel:'@Front',face:'front'});
 const point=(u,v)=>new T.Vector3(u,v,0).applyMatrix4(frame.world).toArray();
 assert.deepEqual(snapSurface(part,frame,point(.7,12.7)),{u:0,v:13,snaps:['U center']});
 const edge=frame.span[0]/2-10;near(snapSurface(part,frame,point(edge-.9,20),{angle:90}).u,edge);
 const free=snapSurface(part,frame,point(.731,12.731),{free:true});near(free.u,.731);near(free.v,12.731);
 const oversized=placeOnSurface({...part,dims:[500,500,10]},frame);assert.equal(oversized.overhang,true);
 assert.throws(()=>placeOnSurface(part,frame,{gap:NaN}),/supported range/);
});
test('actual mesh raycasts find all flat panel sides, including rotated roots',()=>{
 const project=freshProject(),shell=enclosureObject(project.enclosure),ps=panels(project.enclosure);
 shell.rotation.set(.2,.4,-.7);shell.position.set(15,20,-30);shell.updateMatrixWorld(true);
 for(const root of shell.children){const panel=ps.find(p=>p.id===root.userData.partId);for(const face of FACES){const f=faceFrame(panel.dims,face),point=new T.Vector3(...f.origin).applyMatrix4(root.matrixWorld),normal=new T.Vector3(...f.n).transformDirection(root.matrixWorld),ray=new T.Raycaster(point.clone().addScaledVector(normal,20),normal.clone().negate()),hit=ray.intersectObject(root,true).find(h=>h.object.isMesh&&h.face),result=surfaceHit(hit,root,panel);assert.equal(result.panel,panel.id);assert.equal(result.face,face);}}
});
test('cutout interiors cannot masquerade as enclosure mounting planes',async()=>{
 await initGeometry({wasmBinary:await readFile(new URL('../dist/vendor/manifold.wasm',import.meta.url))});const p=freshProject();p.features=[normalizeFeature({...featureDefaults(),id:'cut',host:'@Lid',face:'top',w:40,h:30})];
 const root=enclosureObject(p.enclosure,'closed',0,null,p.features).children.find(o=>o.userData.partId==='@Lid'),panel=panels(p.enclosure).find(p=>p.id==='@Lid');root.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(0,0,p.enclosure.h-3),new T.Vector3(1,0,0)),hit=ray.intersectObject(root,true).find(h=>h.object.isMesh&&h.face);assert.ok(hit);assert.equal(surfaceHit(hit,root,panel),null);
 const surfaceRay=new T.Raycaster(new T.Vector3(50,0,200),new T.Vector3(0,0,-1));const found=surfaceRay.intersectObject(root,true).find(h=>h.object.isMesh&&h.face);assert.equal(surfaceHit(found,root,panel).face,'top');
 // Exercise the editor's actual hit dispatcher, without a WebGL renderer.
 const stage=Object.assign(Object.create(Studio.prototype),{explode:0,project:p,content:root,objects:new Map([['@Lid',root]]),ray:surfaceRay,placementRay(){return this.ray;}});assert.equal(stage.hitSurface(0,0).panel,'@Lid');stage.explode=.5;assert.equal(stage.hitSurface(0,0),null);
});

test('viewport face picking reaches rotated component faces and excludes the component being moved',()=>{
 const p=freshProject();p.enclosure.enabled=false;const target=makePart('block',{id:'target',dims:[80,60,8],pos:[10,20,40],rot:[12,23,34]}),f=faceFrame(target.dims,'top'),root=partObject(target);root.updateMatrixWorld(true);const point=new T.Vector3(...f.origin).applyMatrix4(root.matrixWorld),normal=new T.Vector3(...f.n).transformDirection(root.matrixWorld),moving=makePart('block',{id:'moving',dims:[10,10,10],pos:point.clone().addScaledVector(normal,20).toArray()}),other=partObject(moving),content=new T.Group();content.add(root,other);content.updateMatrixWorld(true);p.parts=[target,moving];
 const ray=new T.Raycaster(point.clone().addScaledVector(normal,100),normal.clone().negate()),stage=Object.assign(Object.create(Studio.prototype),{explode:0,project:p,content,objects:new Map([[target.id,root],[moving.id,other]]),ray,placementRay(){return this.ray;}}),hit=stage.hitSurface(0,0,moving.id);assert.equal(hit.panel,target.id);assert.equal(hit.face,'top');near(new T.Vector3(...hit.point).distanceTo(point),0);
});
