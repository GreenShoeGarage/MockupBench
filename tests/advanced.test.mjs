import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as T from 'three';
import {freshProject,makePart,validateProject,bom,baseline,comparison} from '../dist/model.js';
import {normalizeFeature,featureDefaults} from '../dist/schema.js';
import {initGeometry,editedSolid,editedGeometry,faceFrame,featureContours,profileBounds,panels} from '../dist/geometry.js';
import {groupSelection,moveGroup,groupParts,captureAssembly,insertAssembly,updateInstance,worldPoint,cableLength,powerEstimate,measurePoints,removeParts} from '../dist/assemblies.js';
import {svgDrawing,dxfDrawing} from '../dist/fabrication.js';
import {stepParts,readGLB,productURL} from '../dist/importers.js';
import {partObject,Studio,parseSTL} from '../dist/scene.js';
import {decorateObject} from '../dist/rendering.js';
import {reviewProject} from '../dist/review.js';
await initGeometry({wasmBinary:await readFile(new URL('../dist/vendor/manifold.wasm',import.meta.url))});
const close=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
const part=()=>makePart('block',{dims:[100,80,6],pos:[0,0,0]});
const feature=(host,overrides={})=>normalizeFeature({...featureDefaults(),id:crypto.randomUUID(),host,...overrides});
const volume=(p,features)=>{const s=editedSolid(p,features);assert.equal(s.status(),'NoError');const v=s.volume();s.delete();return v;};

test('true cuts, pockets and text change closed-solid volume, on every face',()=>{
 const p=part();close(volume(p,[]),48000);close(volume(p,[feature(p.id,{w:20,h:10})]),46800);close(volume(p,[feature(p.id,{w:20,h:10,through:false,depth:2})]),47600);
 for(const face of ['top','bottom','front','back','left','right']){const frame=faceFrame(p.dims,face),f=feature(p.id,{face,w:2,h:2});close(volume(p,[f]),48000-4*frame.thickness);}
 for(const font of ['sans','serif','mono']){const f=feature(p.id,{type:'emboss',text:'PORT 1',font,fontSize:8,depth:1});const add=volume(p,[f])-48000,remove=48000-volume(p,[{...f,type:'deboss'}]);assert.ok(add>10);close(add,remove,.01);}
 assert.throws(()=>volume(p,[feature(p.id,{type:'deboss',depth:6})]),/depth/);
});
test('custom polygons, SVG holes and repeated slots become valid solid geometry',()=>{
 const p=part();const polygon=feature(p.id,{shape:'polygon',points:[[0,0],[1,0],[0,1]],w:20,h:10});close(volume(p,[polygon]),47400);
 const svg=feature(p.id,{shape:'svg',contours:[[[-1,-1],[1,-1],[1,1],[-1,1]],[[-.5,-.5],[-.5,.5],[.5,.5],[.5,-.5]]],w:20,h:20});close(volume(p,[svg]),46200);
 const slot=feature(p.id,{shape:'slot',w:10,h:5,rows:2,cols:3,pitchU:20,pitchV:15});const expected=48000-6*6*(25+Math.PI*2.5**2);close(volume(p,[slot]),expected,3);
 const text=feature(p.id,{type:'emboss',text:'A\nB',spacing:1.2});assert.ok(profileBounds(featureContours(text)).size[1]>10);
});
test('exported STL contains the actual through-hole; decorated bounds stay in mm',()=>{
 const p=freshProject(),a=part();p.enclosure.enabled=false;p.parts=[a];p.features=[feature(a.id,{w:20,h:10})];const obj=partObject(a);decorateObject(obj,a,p.features);assert.deepEqual(new T.Box3().setFromObject(obj).getSize(new T.Vector3()).toArray(),a.dims);
 const studio=Object.assign(Object.create(Studio.prototype),{project:p,geometryErrors:[],objects:new Map(),shellMode:'closed',explode:0});const data=studio.exportSTL(a.id),parsed=parseSTL(data.buffer);close(volume({...a,...parsed},[]),46800,.05);
});
test('mesh geometry cache respects replacement geometry with the same part ID',()=>{
 const original=part();const s=editedSolid(original,[]),g=editedGeometry(original,[]);s.delete();const parsed=parseSTL(Object.assign(Object.create(Studio.prototype),{project:{...freshProject(),enclosure:{...freshProject().enclosure,enabled:false},parts:[original]},geometryErrors:[]}).exportSTL().buffer);const mesh={...original,...parsed};const f=feature(mesh.id,{w:10,h:10});const first=editedGeometry(mesh,[f]);mesh.vertices=mesh.vertices.map(n=>n*.8);const second=editedGeometry(mesh,[f]);first.computeBoundingBox();second.computeBoundingBox();assert.ok(first.boundingBox.max.x>second.boundingBox.max.x);g.dispose();first.dispose();second.dispose();
});
test('nested subassembly transform, library insertion and explicit revision update preserve attachment',()=>{
 const p=freshProject(),a=makePart('block',{pos:[-20,0,20]}),b=makePart('block',{pos:[20,0,20]});p.parts=[a,b];const inner=groupSelection(p,[a.id],[],'Inner'),root=groupSelection(p,[b.id],[inner.id],'Controller');p.features=[feature(a.id,{type:'decal',image:'data:image/png;base64,AA==',w:5,h:5})];p.wires=[{id:'wire',name:'Internal',color:'#ff0000',diameter:2,slack:10,zone:'DC',points:[{host:a.id,pos:[0,0,0]},{host:'',pos:[0,0,20]},{host:b.id,pos:[0,0,0]}]}];
 moveGroup(p,root.id,[100,30,40],[0,0,90]);close(a.pos[0],100);close(a.pos[1],10);close(b.pos[1],50);close(cableLength(p,p.wires[0]),44);
 const template=captureAssembly(p,root.id,'Controller'),q=freshProject(),instance=insertAssembly(q,template,[10,20,30],[0,0,45]);assert.equal(groupParts(q,instance.id).length,2);assert.equal(q.features[0].host,q.parts[0].id);assert.equal(q.wires[0].points[0].host,q.parts[0].id);assert.notEqual(q.parts[0].id,a.id);assert.equal(q.groups.length,2);close(cableLength(q,q.wires[0]),44);validateProject(q);
 template.revision=2;template.project.parts[0].name='Revised';const updated=updateInstance(q,instance.id,template);assert.equal(updated.revision,2);assert.deepEqual(updated.origin,[10,20,30]);assert.equal(q.parts[0].name,'Revised');assert.equal(q.parts.length,2);removeParts(q,[q.parts[0].id]);assert.equal(q.features.length,0);assert.equal(q.wires.length,0);
});
test('schema migration and round trip preserve features, suppliers and references; cycles are rejected',()=>{
 const p=freshProject(),a=part();a.supplier='DigiKey';a.supplierNumber='ABC-ND';a.productURL='https://www.digikey.com/example';a.anchors=[{id:'anchor',name:'Mount',pos:[10,10,0]}];p.parts=[a];p.features=[feature(a.id,{type:'deboss',text:'CLIENT'})];p.groups=[{id:'group',name:'Assembly',origin:[0,0,0],rot:[0,0,0],parentId:'',templateId:'',revision:0}];a.groupId='group';assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);const legacy={...freshProject(),schema:1};delete legacy.features;delete legacy.groups;assert.equal(validateProject(legacy).schema,5);assert.throws(()=>validateProject({...p,groups:[{...p.groups[0],parentId:'group'}]}),/Cyclic/);assert.throws(()=>validateProject({...p,features:[feature('missing')]}),/missing host/);assert.equal(productURL('javascript:alert(1)'),'');
});
test('fabrication profiles contain physical units, separate operation layers and mirrored underside',()=>{
 const p=freshProject(),a=part();a.profile=[[-.5,-.5],[.5,-.5],[.5,.2],[-.5,.5]];p.parts=[a];p.features=[feature(a.id,{through:false,depth:2}),feature(a.id,{type:'emboss',text:'X'})];const svg=svgDrawing(p,a.id,'top');assert.match(svg,/width="100mm"/);assert.match(svg,/data-operation="pocket"/);assert.match(svg,/data-operation="emboss"/);const dxf=dxfDrawing(p,a.id,'top');assert.match(dxf,/\$INSUNITS\n70\n4/);assert.match(dxf,/POCKET_2/);assert.match(dxf,/EMBOSS_2/);assert.match(svgDrawing(p,a.id,'bottom'),/50\.00000 -16\.00000/);assert.throws(()=>svgDrawing({...p,parts:[{...a,kind:'mesh'}]},a.id,'top'),/Planar/);
});
test('BOM separates custom machining and supplier differences; baseline detects attached-feature edits',()=>{
 const p=freshProject(),a=part(),b={...structuredClone(a),id:crypto.randomUUID()};p.parts=[a,b];assert.equal(bom(p)[0].quantity,2);p.features=[feature(a.id)];assert.equal(bom(p).length,2);baseline(p,'A');p.features[0].u=1;assert.ok(comparison(p).some(s=>s.includes('Surface features')));const q=validateProject(JSON.parse(JSON.stringify(p)));assert.ok(comparison(q).some(s=>s.includes('Surface features')));
});
test('measurement, power and attached cable estimates use exact entered quantities',()=>{
 assert.deepEqual(measurePoints([[0,0,0],[3,4,0]]).delta,[3,4,0]);close(measurePoints([[0,0,0],[3,4,0]]).length,5);close(measurePoints([[0,0,0],[10,0,0],[10,20,0],[0,20,0]]).area,200);assert.equal(measurePoints([[0,0,0],[10,0,0],[10,20,2],[0,20,0]]).area,null);
 const p=freshProject(),a=makePart('block',{loadW:10,duty:50,zone:'DC',pos:[10,0,0],rot:[0,0,90]});p.parts=[a];p.powerBudget={batteryWh:100,usable:80,efficiency:90};close(powerEstimate(p).hours,14.4);const pt=worldPoint(p,{host:a.id,pos:[10,0,0]});close(pt.x,10);close(pt.y,10);
});
test('review recognizes accepted overlaps and does not erase the observation',()=>{
 const p=freshProject();p.parts=[part(),part()];let f=reviewProject(p).find(f=>f.ids.length===2);assert.ok(f);p.dismissed=[f.key];f=reviewProject(p).find(f=>f.ids.length===2);assert.equal(f.severity,'Accepted');
});

function ownStepBox(){let entities=[],id=0;const add=text=>{entities.push(`#${++id}=${text};`);return '#'+id;};const app=add("APPLICATION_CONTEXT('mechanical design')"),pc=add(`PRODUCT_CONTEXT('',${app},'mechanical')`),prod=add(`PRODUCT('Test box','Test box','',(${pc}))`),formation=add(`PRODUCT_DEFINITION_FORMATION('1','',${prod})`),ctx=add(`PRODUCT_DEFINITION_CONTEXT('part definition',${app},'design')`),definition=add(`PRODUCT_DEFINITION('design','',${formation},${ctx})`),pds=add(`PRODUCT_DEFINITION_SHAPE('','',${definition})`);
 const pts=[[0,0,0],[20,0,0],[20,30,0],[0,30,0],[0,0,40],[20,0,40],[20,30,40],[0,30,40]].map(p=>add(`CARTESIAN_POINT('',(${p.map(n=>n+'.').join(',')}))`));const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(f=>{const loop=add(`POLY_LOOP('',(${f.map(i=>pts[i]).join(',')}))`),bound=add(`FACE_OUTER_BOUND('',${loop},.T.)`);const coordinates=[[0,0,0],[20,0,0],[20,30,0],[0,30,0],[0,0,40],[20,0,40],[20,30,40],[0,30,40]],a=new T.Vector3(...coordinates[f[0]]),b=new T.Vector3(...coordinates[f[1]]),c=new T.Vector3(...coordinates[f[2]]),u=b.sub(a).normalize(),n=u.clone().cross(c.sub(a)).normalize(),axis=add(`DIRECTION('',(${n.toArray().map(x=>x.toFixed(8)).join(',')}))`),ref=add(`DIRECTION('',(${u.toArray().map(x=>x.toFixed(8)).join(',')}))`),placement=add(`AXIS2_PLACEMENT_3D('',${pts[f[0]]},${axis},${ref})`),plane=add(`PLANE('',${placement})`);return add(`ADVANCED_FACE('',(${bound}),${plane},.T.)`);});const shell=add(`CLOSED_SHELL('',(${faces.join(',')}))`),solid=add(`MANIFOLD_SOLID_BREP('Test box',${shell})`),mm=add('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))'),rad=add('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))'),sr=add('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())'),context=add(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNIT_ASSIGNED_CONTEXT((${mm},${rad},${sr}))REPRESENTATION_CONTEXT('','3D'))`),shape=add(`ADVANCED_BREP_SHAPE_REPRESENTATION('',(${solid}),${context})`);add(`SHAPE_DEFINITION_REPRESENTATION(${pds},${shape})`);return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('MOCKUPBENCH generated fixture'),'2;1');\nFILE_NAME('box.step','2026-10-10T00:00:00',(''),(''),'MOCKUPBENCH','MOCKUPBENCH','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\nDATA;\n${entities.join('\n')}\nENDSEC;\nEND-ISO-10303-21;`;}
test('bundled STEP kernel converts an independently generated 20×30×40 mm box',async()=>{
 const module={exports:{}},vendor=new URL('../dist/vendor/',import.meta.url);vm.runInNewContext(await readFile(new URL('occt-import-js.js',vendor),'utf8'),{module,exports:module.exports,require:createRequire(import.meta.url),__dirname:vendor.pathname,process,console,Buffer,WebAssembly,setTimeout,clearTimeout,TextDecoder});const occt=await module.exports({wasmBinary:await readFile(new URL('occt-import-js.wasm',vendor))});const result=occt.ReadStepFile(new TextEncoder().encode(ownStepBox()),{linearUnit:'millimeter',linearDeflectionType:'absolute_value',linearDeflection:.2,angularDeflection:.3});const {parts,groups}=stepParts(result,'box.step');assert.equal(parts.length,1);assert.deepEqual(parts[0].dims,[20,30,40]);assert.ok(groups.length>0);close(volume(parts[0],[]),24000,.01);
});

// Node-only Blob reader permits testing glTF serialization, without a browser or renderer.
class BlobReader{readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result='data:'+blob.type+';base64,'+Buffer.from(r).toString('base64');this.onloadend?.();});}}
globalThis.FileReader=BlobReader;
test('GLB export/import preserves millimeter scale, Z-up orientation and colors',async()=>{
 const p=freshProject();p.enclosure.enabled=false;p.parts=[makePart('block',{dims:[20,30,40],pos:[12,25,30],color:'#287651'})];const studio=Object.assign(Object.create(Studio.prototype),{project:p,geometryErrors:[],objects:new Map(),shellMode:'closed',explode:0});const data=await studio.exportGLB(),result=await readGLB(data,'client.glb');assert.equal(result.parts.length,1);result.parts[0].dims.forEach((n,i)=>close(n,p.parts[0].dims[i],.001));result.parts[0].pos.forEach((n,i)=>close(n,p.parts[0].pos[i],.001));assert.equal(result.parts[0].color,p.parts[0].color);
});
