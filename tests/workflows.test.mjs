import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {CATALOG,freshProject,demoProject,validateProject,makePart,rotatedHalf,inspect,bomCSV,baseline,comparison,bom} from '../dist/model.js';
import {partObject,enclosureObject,parseSTL} from '../dist/scene.js';
import {STLExporter} from '../dist/vendor/STLExporter.js';
test('project JSON round trip preserves an editable sample and dimensions',()=>{
 const p=demoProject();p.units='in';p.parts[0].manufacturer='Example';p.parts[0].notes='Client change';const out=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(out,p);
});
test('geometry bounds follow XYZ rotations at arbitrary angles',()=>{
 for(const rot of [[0,0,0],[0,0,90],[23,51,78],[-72,128,26]]){const dims=[70,25,11],mesh=new T.Mesh(new T.BoxGeometry(...dims));mesh.rotation.set(...rot.map(a=>a*Math.PI/180));const actual=new T.Box3().setFromObject(mesh).getSize(new T.Vector3()).toArray();rotatedHalf(dims,rot).forEach((n,i)=>assert.ok(Math.abs(2*n-actual[i])<1e-8));}
});
test('enclosure outside dimensions and wall panels are exact',()=>{
 const e=freshProject().enclosure,g=enclosureObject(e),size=new T.Box3().setFromObject(g).getSize(new T.Vector3());assert.deepEqual(size.toArray(),[e.w,e.d,e.h]);assert.equal(g.children.length,6);assert.equal(enclosureObject(e,'open').children.length,5);assert.equal(enclosureObject(e,'none').children.length,0);
 const base=g.children.find(a=>a.name==='Enclosure Base');assert.equal(new T.Box3().setFromObject(base).getSize(new T.Vector3()).z,e.t);
});
test('catalog component meshes respect their advertised envelopes',()=>{
 for(const c of CATALOG){const p=makePart(c.key,{pos:[0,0,0]}),g=partObject(p),box=new T.Box3().setFromObject(g);const h=p.dims.map(n=>n/2);box.min.toArray().forEach((n,i)=>assert.ok(n>=-h[i]-.01,`${c.name} min ${i}: ${n}`));box.max.toArray().forEach((n,i)=>assert.ok(n<=h[i]+.01,`${c.name} max ${i}: ${n}`));}
});
test('STL binary and ASCII round trips preserve mm scale; inch import converts explicitly',()=>{
 const mesh=new T.Mesh(new T.BoxGeometry(20,40,60),new T.MeshBasicMaterial());mesh.position.set(12,3,20);mesh.updateMatrixWorld(true);const exp=new STLExporter();for(const binary of [true,false]){const data=exp.parse(mesh,{binary}),buffer=binary?data.buffer:new TextEncoder().encode(data).buffer;const m=parseSTL(buffer);assert.deepEqual(m.dims,[20,40,60]);assert.equal(m.vertices.length,108);assert.deepEqual(parseSTL(buffer,'in').dims,[508,1016,1524]);const p=freshProject();p.parts=[makePart('block',{...m})];assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))).parts[0].vertices,m.vertices);}
});
test('project import rejects malformed, oversized and non-finite geometry',()=>{
 const p=demoProject();assert.throws(()=>validateProject({...p,schema:99}));assert.throws(()=>validateProject({...p,enclosure:{...p.enclosure,t:90}}));assert.throws(()=>validateProject({...p,enclosure:{...p.enclosure,w:915}}));assert.throws(()=>validateProject({...p,parts:[{...p.parts[0],dims:[1,NaN,3]}]}));assert.throws(()=>validateProject({...p,parts:[p.parts[0],p.parts[0]]}));assert.throws(()=>validateProject({...p,parts:[{...p.parts[0],kind:'mesh',vertices:[1,2,3]}]}));
});
test('fit review flags overlap, enclosure crossings and service clearance without counting contact',()=>{
 const p=freshProject();p.parts=[makePart('block',{name:'A',dims:[20,20,20],pos:[0,0,30],confidence:'measured'}),makePart('block',{name:'B',dims:[20,20,20],pos:[20,0,30],confidence:'measured'})];assert.equal(inspect(p).length,0);p.parts[1].pos[0]=19;assert.equal(inspect(p).length,1);p.parts[1].pos[0]=150;assert.ok(inspect(p).some(f=>f.text.includes('enclosure walls')));p.parts[1]=makePart('space',{pos:[0,0,30]});assert.ok(inspect(p).some(f=>f.text.includes('clearance volume occupied')));
});
test('BOM groups repeated parts but excludes service volumes; CSV formula cells are escaped',()=>{
 const p=freshProject();p.parts=[makePart('block',{name:'=SUM(1)',cost:5}),makePart('block',{name:'=SUM(1)',cost:5}),makePart('space')];assert.equal(bom(p).length,1);assert.equal(bom(p)[0].quantity,2);assert.ok(bomCSV(p).includes('"\'=SUM(1)"'));
});
test('baseline survives export and detects moved, added and removed components',()=>{
 let p=demoProject();baseline(p,'Concept A');assert.deepEqual(comparison(p),[]);p=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(comparison(p),[]);p.parts[0].pos[0]+=1;p.parts.pop();p.parts.push(makePart('fan'));assert.ok(comparison(p).some(a=>a.startsWith('Changed')));assert.ok(comparison(p).some(a=>a.startsWith('Removed')));assert.ok(comparison(p).some(a=>a.startsWith('Added')));
});
test('full concept STL is parsable and includes the closed enclosure',()=>{
 const p=demoProject(),g=new T.Group();g.add(enclosureObject(p.enclosure));for(const a of p.parts)g.add(partObject(a));g.updateMatrixWorld(true);const data=new STLExporter().parse(g,{binary:true});const result=parseSTL(data.buffer);assert.ok(result.vertices.length>1000);assert.deepEqual(result.dims,[300,220,122]);
});
