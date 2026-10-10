import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import * as T from 'three';
import {freshProject,makePart,validateProject} from '../dist/model.js';
import {Studio,partObject} from '../dist/scene.js';
import {TransformControls} from '../dist/vendor/TransformControls.js';
import {snapPosition,bindTransformControls,configureTransform,transformDefaults,cancelTransform} from '../dist/transforms.js';
import {createJoint} from '../dist/motion.js';
import {surfaceFrame,placeOnSurface,surfacePosition,surfaces} from '../dist/placement.js';
import {groupSelection,captureAssembly,insertAssembly,removeParts} from '../dist/assemblies.js';
import {FACES,faceFrame} from '../dist/geometry.js';
import {matrix} from '../dist/motion.js';
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const part=(id,pos=[0,0,0],dims=[20,20,20],rot=[0,0,0])=>makePart('block',{id,name:id,pos,dims,rot});

test('nearby snaps align contacts, gaps, edges and centers without moving constrained axes',()=>{
 const a=part('moving',[.4,3,4]),b=part('target',[30,3,4]);
 let r=snapPosition(a,[b],{axis:'X',threshold:10});near(r.pos[0],10);assert.deepEqual(r.pos.slice(1),[3,4]);assert.equal(r.snaps[0].kind,'face + gap');
 r=snapPosition({...a,pos:[7.2,3,4]},[b],{axis:'X',gap:3,threshold:1});near(r.pos[0],7);assert.equal(r.snaps[0].target,b.id);
 r=snapPosition({...a,pos:[29.6,3,4]},[b],{axis:'X',threshold:1});near(r.pos[0],30);assert.equal(r.snaps[0].kind,'center');
 r=snapPosition({...a,pos:[24.8,3,4],dims:[10,10,10]},[b],{axis:'X',threshold:1});near(r.pos[0],25);assert.equal(r.snaps[0].kind,'minimum edge');
 for(const target of [{...b,visible:false},{...b,kind:'space'},{...b,pos:[30,1000,0]},{...b,id:a.id}])assert.equal(snapPosition(a,[target],{axis:'X',threshold:10}).snaps.length,0);
});

test('local-axis snaps preserve the other local coordinates on arbitrarily rotated bodies',()=>{
 for(const rot of [[0,0,90],[13,27,37]]){const q=new T.Quaternion().setFromEuler(new T.Euler(...rot.map(n=>n*Math.PI/180))),world=a=>new T.Vector3(...a).applyQuaternion(q).toArray(),a=part('moving',world([7.2,3,4]),[20,20,20],rot),b=part('target',world([30,3,4]),[20,20,20],rot),r=snapPosition(a,[b],{axis:'X',space:'local',gap:3,threshold:1}),local=new T.Vector3(...r.pos).applyQuaternion(q.clone().invert());near(local.x,7);near(local.y,3);near(local.z,4);}
});

function stage(){const {document,window}=parseHTML('<html><body><canvas></canvas></body></html>');Object.assign(globalThis,{document,window});const canvas=document.querySelector('canvas'),p=freshProject();p.enclosure.enabled=false;p.parts=[part('a'),part('b',[30,0,0])];const scene=new T.Scene(),camera=new T.OrthographicCamera(-100,100,100,-100,.1,2000);camera.position.set(0,0,200);camera.lookAt(0,0,0);camera.updateMatrixWorld();const transform=new TransformControls(camera,canvas),objects=new Map(p.parts.map(p=>[p.id,partObject(p)]));scene.add(...objects.values(),transform.getHelper());const previews=[],commits=[],s=Object.assign(Object.create(Studio.prototype),{scene,camera,transform,objects,project:p,selected:null,tool:'orbit',pickMode:'select',explode:0,orbit:{enabled:true},host:{clientHeight:500},renderer:{domElement:canvas},events:{tool(){},transformPreview:(...args)=>previews.push(args),transformCommit:(id,pos,rot)=>{commits.push(structuredClone(p));Object.assign(p.parts.find(p=>p.id===id),{pos,rot});validateProject(p);}},render(){}});bindTransformControls(s);s.select('a');scene.updateMatrixWorld(true);return {s,p,transform,objects,previews,commits,window,canvas,ndc:(x,y)=>({x:x/100,y:y/100,button:0})};}

test('selecting a part automatically attaches all three axes and remembers move or rotate mode',()=>{
 const t=stage(),{s,transform,p}=t;assert.equal(s.tool,'translate');assert.equal(transform.object,t.objects.get('a'));assert.equal(transform.getHelper().visible,true);assert.equal(transform.showX,true);assert.equal(transform.showY,true);assert.equal(transform.showZ,true);
 s.setTool('rotate');s.select('b');assert.equal(transform.mode,'rotate');assert.equal(transform.object,t.objects.get('b'));s.setTool('orbit');assert.equal(transform.object,undefined);s.select('b',{auto:true});assert.equal(transform.mode,'rotate');
 p.parts[1].locked=true;s.select('b');assert.equal(transform.object,undefined);p.parts[1].locked=false;p.joints=[createJoint(p,{child:'b',type:'slider'})];s.select('b');assert.equal(transform.object,undefined);p.joints=[];s.explode=.5;s.select('a');assert.equal(transform.object,undefined);
});

test('actual TransformControls pointer movement previews, snaps and commits exactly once',()=>{
 const t=stage(),{s,p,transform,objects,ndc}=t,before=JSON.stringify(p);configureTransform(s,{...transformDefaults(),step:0});transform.axis='X';s.scene.updateMatrixWorld(true);transform.pointerDown(ndc(0,0));assert.ok(s.transformDraft);transform.pointerMove({...ndc(9.5,0),button:-1});near(objects.get('a').position.x,10);assert.ok(s.snapGuide);assert.equal(JSON.stringify(p),before);assert.equal(t.previews.at(-1)[3][0].target,'b');transform.pointerUp(ndc(9.5,0));assert.equal(t.commits.length,1);near(p.parts[0].pos[0],10);assert.equal(s.snapGuide,null);
 transform.axis='X';s.scene.updateMatrixWorld(true);transform.pointerDown(ndc(10,0));transform.pointerUp(ndc(10,0));assert.equal(t.commits.length,1,'Clicking a handle without moving adds no history');
});

test('rotation rings use configured angle steps; Escape and pointer cancellation restore the saved pose',()=>{
 const t=stage(),{s,p,transform,objects,ndc}=t;s.setTool('rotate');configureTransform(s,{...transformDefaults(),angle:15});transform.axis='Z';s.scene.updateMatrixWorld(true);transform.pointerDown(ndc(20,0));transform.pointerMove({...ndc(20*Math.cos(.52),20*Math.sin(.52)),button:-1});near(objects.get('a').rotation.z,Math.PI/6);assert.equal(p.parts[0].rot[2],0);transform.pointerUp(ndc(0,0));near(p.parts[0].rot[2],30);assert.equal(t.commits.length,1);
 s.setTool('translate');transform.axis='X';s.scene.updateMatrixWorld(true);transform.pointerDown(ndc(0,0));transform.pointerMove({...ndc(50,0),button:-1});const event=new t.window.Event('keydown',{cancelable:true});event.key='Escape';t.window.dispatchEvent(event);assert.equal(s.transformDraft,null);near(objects.get('a').position.x,0);assert.equal(t.commits.length,1);assert.equal(event.defaultPrevented,true);assert.equal(s.orbit.enabled,true);
 transform.axis='X';s.scene.updateMatrixWorld(true);transform.pointerDown(ndc(0,0));objects.get('a').position.x=70;t.canvas.dispatchEvent(new t.window.Event('pointercancel'));near(objects.get('a').position.x,0);assert.equal(t.commits.length,1);
});

test('Alt temporarily disables grid, angle and relative snapping and restores configured values',()=>{
 const t=stage(),{s,transform,ndc}=t;configureTransform(s,{...transformDefaults(),step:5,angle:30});const e=new t.window.Event('pointermove');e.altKey=true;t.canvas.dispatchEvent(e);assert.equal(transform.translationSnap,null);assert.equal(transform.rotationSnap,null);transform.axis='X';s.scene.updateMatrixWorld(true);transform.pointerDown(ndc(0,0));transform.pointerMove({...ndc(9.25,0),button:-1});near(t.objects.get('a').position.x,9.25);assert.ok(!s.snapGuide);cancelTransform(s);const up=new t.window.Event('keyup');up.key='Alt';t.window.dispatchEvent(up);assert.equal(transform.translationSnap,5);near(transform.rotationSnap,Math.PI/6);
});

test('part-to-part face placement handles every mounting face, rotated targets and persisted references',()=>{
 const p=freshProject(),a=part('a',[0,0,0],[10,7,3]),b=part('b',[37,-29,88],[80,50,12],[17,-25,39]);p.parts=[a,b];p.enclosure.enabled=false;assert.equal(surfaces(p,a.id).length,6);
 for(const face of FACES)for(const mount of FACES){const f=surfaceFrame(p,{panel:b.id,face}),v={u:5.5,v:-3.25,gap:1.2,mount,angle:23},pose=placeOnSurface(a,f,v);Object.assign(a,pose);const m=matrix(a.pos,a.rot),source=faceFrame(a.dims,mount),center=new T.Vector3(...source.origin).applyMatrix4(m).applyMatrix4(f.world.clone().invert());near(center.x,v.u);near(center.y,v.v);near(center.z,v.gap);const n=new T.Vector3(...source.n).transformDirection(m),target=new T.Vector3(0,0,1).transformDirection(f.world);near(n.dot(target),-1);const saved=validateProject(JSON.parse(JSON.stringify(p))),position=surfacePosition(saved,saved.parts[0]);near(position.gap,1.2);assert.equal(saved.parts[0].surfaceRef.panel,'b');}
 assert.throws(()=>validateProject({...p,parts:[{...a,surfaceRef:{panel:a.id,face:'top'}}]}),/placement reference/);
});

test('reusable assemblies remap internal references, omit external ones and safely clear deleted targets',()=>{
 const p=freshProject(),a=part('a'),b=part('b',[30,0,0]),outside=part('outside',[0,40,0]);p.parts=[a,b,outside];a.surfaceRef={panel:b.id,face:'left',mount:'right'};b.surfaceRef={panel:outside.id,face:'top',mount:'bottom'};const group=groupSelection(p,[a.id,b.id],[],'Pair'),template=captureAssembly(p,group.id);assert.equal(template.project.parts[0].surfaceRef.panel,b.id);assert.equal(template.project.parts[1].surfaceRef,undefined);const inserted=insertAssembly(p,template,[100,0,0]);const copies=p.parts.filter(p=>p.groupId===inserted.id);assert.equal(copies[0].surfaceRef.panel,copies[1].id);assert.notEqual(copies[0].surfaceRef.panel,b.id);const originalPos=[...a.pos];removeParts(p,[b.id]);assert.equal(a.surfaceRef,undefined);assert.deepEqual(a.pos,originalPos);validateProject(p);
});
