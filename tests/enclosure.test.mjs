import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {freshProject,validateProject,makePart,inspect,baseline,comparison} from '../dist/model.js';
import {normalizeFeature} from '../dist/schema.js';
import {closureDefaults,normalizeClosure,ENCLOSURE_STYLES,closureOpenMatrix} from '../dist/enclosure.js';
import {initGeometry,panels,primitiveSolid,editedSolid,editedGeometry} from '../dist/geometry.js';
import {enclosureObject,applyPanelPose,Studio} from '../dist/scene.js';
import {disposeObject} from '../dist/rendering.js';
import {createMovieModel} from '../dist/cinematic.js';
import {movieDefaults} from '../dist/movie.js';
import {buildDrawings} from '../dist/drawings.js';
import {svgDrawing,dxfDrawing} from '../dist/fabrication.js';
import {STLLoader} from '../dist/vendor/STLLoader.js';
await initGeometry({wasmBinary:await readFile(new URL('../dist/vendor/manifold.wasm',import.meta.url))});
const near=(a,b,e=1e-4)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function worldSolid(p){const local=primitiveSolid(p),world=local.translate(p.pos);local.delete();return world;}

test('all enclosure closures produce six valid panels without closed-panel interference at two sizes',()=>{
 for(const size of [{w:300,d:220,h:110,t:6},{w:100,d:80,h:40,t:3}])for(const type of Object.keys(ENCLOSURE_STYLES)){
  const e={...freshProject().enclosure,...size};e.closure={...closureDefaults(e),type};const parts=panels(e),solids=parts.map(worldSolid);assert.deepEqual(parts.map(p=>p.id),['@Base','@Left','@Right','@Front','@Back','@Lid']);
  try{for(const s of solids){assert.equal(s.status(),'NoError');assert.ok(s.volume()>0);}for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++){const overlap=solids[i].intersect(solids[j]);try{assert.ok(overlap.volume()<1e-4,`${type}: ${parts[i].id} intersects ${parts[j].id}: ${overlap.volume()}`);}finally{overlap.delete();}}}finally{solids.forEach(s=>s.delete());}
 }
});

test('hinged and sliding open views use their real axes, keep clearance and respect explicit joint poses',()=>{
 for(const type of ['hinge','slide']){const e=freshProject().enclosure;e.closure.type=type;const ps=panels(e),lid=ps.at(-1),closed=worldSolid(lid),opened=closed.transform(closureOpenMatrix(e).elements);closed.delete();
  try{for(const p of ps.slice(0,-1)){const s=worldSolid(p),overlap=opened.intersect(s);try{near(overlap.volume(),0);}finally{overlap.delete();s.delete();}}}finally{opened.delete();}
  const root=enclosureObject(e,'open'),o=root.children.find(o=>o.userData.partId==='@Lid'),point=new T.Vector3(...lid.pos).applyMatrix4(closureOpenMatrix(e));assert.equal(root.children.length,6);near(o.position.distanceTo(point),0);applyPanelPose(o,lid,e,'open',0,true);assert.deepEqual(o.position.toArray(),lid.pos);near(o.rotation.x,0);disposeObject(root);
 }
 assert.equal(enclosureObject(freshProject().enclosure,'open').children.length,5);
});

test('closure migration, parameter changes and undo snapshots preserve feature identity and invalidate mesh cache',()=>{
 const p=freshProject();p.features=[normalizeFeature({id:'label',host:'@Lid',type:'deboss',text:'EDIT',fontSize:5,u:20})];
 for(const schema of [1,2,3]){const old=structuredClone(p);old.schema=schema;delete old.enclosure.closure;const migrated=validateProject(old);assert.equal(migrated.schema,5);assert.equal(migrated.enclosure.closure.type,'plain');assert.deepEqual(migrated.features,p.features);}
 const minimal={...p,enclosure:{...p.enclosure,w:5,d:5,h:5,t:2.4999}};delete minimal.enclosure.closure;assert.equal(validateProject(minimal).enclosure.closure.type,'plain');
 baseline(p,'Before');for(const type of Object.keys(ENCLOSURE_STYLES)){p.enclosure.closure.type=type;const loaded=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(loaded.enclosure,p.enclosure);assert.deepEqual(loaded.features,p.features);const solid=editedSolid(panels(loaded.enclosure).at(-1),loaded.features);assert.equal(solid.status(),'NoError');solid.delete();}
 assert.ok(comparison(p).includes('Enclosure changed'));p.enclosure.closure.type='external';const a=editedGeometry(panels(p.enclosure).at(-1),[]);a.computeBoundingBox();const before=a.boundingBox.max.x;p.enclosure.closure.ear=15;const b=editedGeometry(panels(p.enclosure).at(-1),[]);b.computeBoundingBox();assert.ok(b.boundingBox.max.x>before);a.dispose();b.dispose();
 for(const c of [{type:'unknown'},{type:'slide',groove:6},{type:'hinge',hingeLength:400},{type:'snap',snapLength:100},{type:'internal',boss:2},{type:'external',ear:1},{clearance:NaN}])assert.throws(()=>normalizeClosure({...p.enclosure.closure,...c},p.enclosure));
});

test('styled geometry reaches STL, movie and drawing exports; planar profiles cannot silently omit it',async()=>{
 const p=freshProject();p.enclosure.closure.type='external';const before=JSON.stringify(p),studio={project:p,geometryErrors:[],wood:null};studio.buildExport=Studio.prototype.buildExport;
 const stl=Studio.prototype.exportSTL.call(studio),g=new STLLoader().parse(stl.buffer);g.computeBoundingBox();near(g.boundingBox.min.x,-161.1,.001);near(g.boundingBox.max.x,161.1,.001);g.dispose();
 const movie=createMovieModel(p,movieDefaults());near(movie.assembled.max.x,161.1,.001);disposeObject(movie.root);
 const drawings=await buildDrawings(p,{partDetails:false,surfaceDetails:false,wiring:false});near(drawings.sheets[0].dimensions[0].valueMM,322.2,.001);assert.equal(drawings.manifest.enclosure.closure.type,'external');assert.ok(drawings.manifest.parts.find(p=>p.id==='@Lid').closureOperations.length);assert.ok(drawings.sheets.some(s=>s.title==='Enclosure / closure parameters'));assert.ok(drawings.sheets.some(s=>s.title==='Enclosure / closure geometry'));
 assert.throws(()=>svgDrawing(p,'@Lid','top'),/3D enclosure closure/);assert.throws(()=>dxfDrawing(p,'@Lid','top'),/3D enclosure closure/);assert.match(svgDrawing(p,'@Lid','top',true),/artwork/);assert.match(svgDrawing(p,'@Base','bottom'),/<svg/);assert.equal(JSON.stringify(p),before);
});

test('sliding lid reduces usable inside height in fit checks',()=>{
 const p=freshProject();p.parts=[makePart('block',{dims:[10,10,3],pos:[0,0,102]})];assert.equal(inspect(p).filter(f=>f.text.includes('enclosure walls')).length,0);p.enclosure.closure.type='slide';assert.equal(inspect(p).filter(f=>f.text.includes('enclosure walls')).length,1);
});
