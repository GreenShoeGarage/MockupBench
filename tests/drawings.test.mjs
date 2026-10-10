import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {freshProject,makePart,validateProject} from '../dist/model.js';
import {normalizeFeature} from '../dist/schema.js';
import {initGeometry} from '../dist/geometry.js';
import {createJoint} from '../dist/motion.js';
import {wireDetails} from '../dist/harness.js';
import {drawingDefaults,normalizeDrawingOptions} from '../dist/drawing-options.js';
import {DRAWING_VIEWS,projectPoint,bodyGeometry,projectGeometry} from '../dist/drawing-geometry.js';
import {buildDrawings,packageDrawings,drawingScale} from '../dist/drawings.js';
import {drawingSVG,textWidth} from '../dist/drawing-format.js';
await initGeometry({wasmBinary:await readFile(new URL('../dist/vendor/manifold.wasm',import.meta.url))});
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const fixture=()=>{const p=freshProject();p.enclosure.enabled=false;p.parts=[makePart('block',{dims:[100,60,10],pos:[20,30,40],name:'Café Δ – mounting plate'})];return p;};
const basic={partDetails:false,surfaceDetails:false,wiring:false};
const allText=r=>r.sheets.flatMap(s=>s.commands.filter(c=>c.type==='text').map(c=>c.text)).join('\n');

test('drawing settings migrate and round trip without changing existing geometry',()=>{
 const p=freshProject();delete p.drawings;assert.deepEqual(validateProject(p).drawings,drawingDefaults());p.drawings={...drawingDefaults(),paper:'a4',units:'in',precision:4,revision:'B'};assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))).drawings,p.drawings);
 for(const o of [{paper:'a0'},{units:'cm'},{precision:1.5},{scale:3}])assert.throws(()=>normalizeDrawingOptions(o));assert.equal(drawingScale(.47),.25);assert.throws(()=>drawingScale(.5,1),/does not fit/);
});

test('six outside-looking orthographic views use exact extents and signed location datums',async()=>{
 const p=fixture(),before=JSON.stringify(p),r=await buildDrawings(p,basic),expected={top:[100,60,20,30],bottom:[100,60,20,-30],left:[60,10,-30,40],right:[60,10,30,40],front:[100,10,20,40],back:[100,10,-20,40]};
 assert.equal(r.sheets[0].kind,'isometric');assert.deepEqual(r.sheets[0].dimensions.map(d=>d.valueMM),[100,60,10]);
 for(const [key,[w,h,u,v]] of Object.entries(expected)){const s=r.sheets.find(s=>s.view===key),d=s.dimensions.find(d=>d.kind==='projected location');assert.ok(s,key);near(s.dimensions[0].valueMM,w);near(s.dimensions[1].valueMM,h);near(d.widthMM,w);near(d.heightMM,h);near(d.uMM,u);near(d.vMM,v);assert.deepEqual(projectPoint([20,30,40],DRAWING_VIEWS[key]).slice(0,2),[u,v]);}
 assert.equal(JSON.stringify(p),before);assert.match(allText(r),/Café Δ/);
});

test('drawings use saved joint pose, rotated envelopes and explicit hidden-part inclusion',async()=>{
 const p=fixture();p.parts.push(makePart('block',{dims:[10,20,30],pos:[10,0,0],visible:false}));p.parts.push(makePart('space'));p.parts[0].rot=[0,0,90];p.joints=[createJoint(p,{child:p.parts[0].id,type:'slider',axis:[1,0,0],values:[25,0,0]})];const before=JSON.stringify(p),r=await buildDrawings(p,basic);near(r.manifest.parts[0].centerMM[0],45);assert.equal(r.manifest.parts.length,2);const d=r.sheets.find(s=>s.view==='top').dimensions.find(d=>d.ref==='P01');near(d.widthMM,60);near(d.heightMM,100);const visible=await buildDrawings(p,{...basic,includeHidden:false});assert.equal(visible.manifest.parts.length,1);assert.equal(JSON.stringify(p),before);
});

test('cut patterns, lettering, profiles, reference coordinates and wiring retain real dimensions',async()=>{
 const p=fixture(),a=p.parts[0];a.profile=[[-.5,-.5],[.5,-.5],[.5,.3],[-.5,.5]];a.anchors=[{id:'a',name:'Mount A',pos:[5,8,0]}];p.features=[normalizeFeature({id:'f1',host:a.id,name:'Slots',shape:'slot',w:12,h:5,rows:2,cols:2,pitchU:20,pitchV:15,u:4,v:2}),normalizeFeature({id:'f2',host:a.id,type:'emboss',text:'A',fontSize:4,u:0,v:22,depth:1}),normalizeFeature({id:'f3',host:a.id,shape:'polygon',points:[[-.5,-.5],[.5,-.5],[0,.5]],w:4,h:4,u:-30,v:0,depth:2,through:false})];
 p.wires=[{...wireDetails({}),id:'w',name:'Route',diameter:2,slack:10,extraLength:5,points:[{host:'',pos:[0,0,0]},{host:'',pos:[3,4,0]},{host:'',pos:[3,4,12]}]}];const r=await buildDrawings(p,{partDetails:true});assert.equal(r.manifest.features.length,3);assert.equal(r.manifest.features[0].contoursMM.length,4);assert.equal(r.manifest.features[0].pitchUMM,20);assert.equal(r.manifest.features[1].fontSizeMM,4);assert.equal(r.manifest.features[2].depthMM,2);assert.equal(r.manifest.features[2].through,false);assert.deepEqual(r.manifest.wires[0].segmentsMM,[5,12]);near(r.manifest.wires[0].cutLengthMM,23.7);assert.match(allText(r),/Mount A/);assert.ok(r.sheets.some(s=>s.title.includes('custom outline')));assert.ok(r.sheets.some(s=>s.title.includes('custom contour')));assert.ok(r.sheets.find(s=>s.kind==='component').dimensions.some(d=>d.kind==='nominal body'));
});

test('depth testing hides fully occluded details while preserving visible box edges',()=>{
 for(const dims of [[100,60,10],[100,80,60]]){const box=projectGeometry([bodyGeometry(makePart('block',{dims,pos:[20,30,40]}))],'iso');assert.equal(box.lines.length,12,'No spurious visibility breaks along straight edges');assert.equal(box.lines.filter(e=>!e.hidden).length,9);assert.equal(box.lines.filter(e=>e.hidden).length,3);}
 const outer=bodyGeometry(makePart('block',{dims:[100,80,60],pos:[0,0,0]})),inner=bodyGeometry(makePart('block',{dims:[10,10,10],pos:[0,0,0]}));outer.ref='outer';inner.ref='inner';const p=projectGeometry([outer,inner],'iso',{resolution:500,shaded:true});assert.ok(p.lines.filter(e=>e.ref==='inner').every(e=>e.hidden));assert.ok(p.lines.some(e=>e.ref==='outer'&&!e.hidden));assert.ok(p.raster.pixels.some(x=>x<255));const visible=projectGeometry([outer,inner],'front',{hiddenLines:false});assert.ok(visible.lines.every(e=>!e.hidden&&e.ref!=='inner'));
});

test('curved bodies retain both side silhouettes in orthographic elevations',()=>{
 const body=bodyGeometry(makePart('rod',{dims:[20,20,40],pos:[0,0,0]}));
 for(const view of ['front','back','left','right']){const p=projectGeometry([body],view,{hiddenLines:false}),vertical=p.lines.filter(e=>Math.abs(e.points[0][0]-e.points[1][0])<1e-5&&Math.abs(e.points[0][1]-e.points[1][1])>39.9);assert.ok(vertical.length>=2,view+' cylinder side outlines');near(Math.min(...vertical.map(e=>e.points[0][0])),-10);near(Math.max(...vertical.map(e=>e.points[0][0])),10);}
});

test('inch labels convert correctly and never round small nonzero model dimensions to zero',async()=>{
 const p=fixture();p.parts[0].dims=[25.4,12.7,.01];const r=await buildDrawings(p,{...basic,units:'in',precision:2}),top=r.sheets.find(s=>s.view==='top'),front=r.sheets.find(s=>s.view==='front');assert.equal(top.dimensions[0].label,'1.00');assert.equal(top.dimensions[1].label,'0.50');assert.ok(Number(front.dimensions[1].label)>0);near(r.manifest.parts[0].dimensionsMM[2],.01);p.parts[0].dims=[100,60,10];await assert.rejects(buildDrawings(p,{...basic,paper:'a4',scale:5}),/does not fit/);
});

test('small paper paginates crowded surfaces, overhanging artwork and 199-segment route tables',async()=>{
 const p=fixture();p.title='Long title '.repeat(16);p.client='Long client '.repeat(80);p.features=Array.from({length:16},(_,i)=>normalizeFeature({id:'f'+i,host:p.parts[0].id,name:'Feature '+i,type:'decal',u:i*15-100,v:0,w:8,h:8}));p.wires=[{...wireDetails({}),id:'w',name:'Long route',diameter:1,slack:0,points:Array.from({length:200},(_,i)=>({host:'',pos:[i*2,0,0]}))}];
 const r=await buildDrawings(p,{paper:'a4',partDetails:true}),surfaces=r.sheets.filter(s=>s.kind==='surface');assert.ok(surfaces.length>1);const refs=surfaces.flatMap(s=>s.dimensions.filter(d=>d.kind==='surface feature').map(d=>d.ref));assert.equal(refs.length,16);assert.equal(new Set(refs).size,16);assert.ok(r.sheets.filter(s=>s.title==='Wiring register / route dimensions').length>1);assert.match(allText(r),/199: 2.00/);
 for(const s of r.sheets)for(const c of s.commands){if(c.type==='text'){assert.ok(c.y<s.h-7,`${s.title}: ${c.text} off bottom at ${c.y}`);if(!c.rotate){const width=textWidth(c.text,c.size),left=c.x-(c.align==='center'?width/2:c.align==='right'?width:0);assert.ok(left>=6&&left+width<=s.w-6,`${s.title}: ${c.text} outside horizontal bounds`);}}if(c.type==='path')for(const [x,y] of c.points)assert.ok(x>=5&&y>=5&&x<=s.w-5&&y<=s.h-5,`${s.title}: path off page ${x},${y}`);}
});

test('cancel and empty geometry fail cleanly without mutating the model',async()=>{
 const p=fixture(),before=JSON.stringify(p),controller=new AbortController();controller.abort();await assert.rejects(buildDrawings(p,basic,{signal:controller.signal}),{name:'AbortError'});assert.equal(JSON.stringify(p),before);p.parts=[];await assert.rejects(buildDrawings(p,basic),/Add a part/);
 const next=new AbortController();p.parts=[makePart('block')];await assert.rejects(buildDrawings(p,basic,{signal:next.signal,onProgress:()=>next.abort()}),{name:'AbortError'});
});

test('actual PDF and ZIP parse independently with physical sheet sizes, Unicode, dimensions and embedded images',async()=>{
 const p=fixture(),r=await buildDrawings(p,{...basic,paper:'a4'}),output=await packageDrawings(r,await readFile(new URL('../dist/vendor/drawing-font.ttf',import.meta.url))),dir=await mkdtemp(join(tmpdir(),'mockupbench-drawings-'));
 try{await writeFile(join(dir,'drawings.pdf'),output.pdf);await writeFile(join(dir,'drawings.zip'),output.zip);const parsed=spawnSync('python3',['-c',`import sys,json,zipfile,xml.etree.ElementTree as ET\nimport fitz\np=fitz.open(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2]); assert z.testzip() is None\nassert z.read('engineering-drawings.pdf')==open(sys.argv[1],'rb').read()\nfor n in z.namelist():\n if n.endswith('.svg'): ET.fromstring(z.read(n))\nm=json.loads(z.read('dimensions.json')); print(json.dumps({'pages':len(p),'size':list(p[0].rect),'text':'\\n'.join(x.get_text() for x in p),'images':len(p[0].get_images()),'sheets':len(m['sheets']),'name':m['parts'][0]['name']}))`,join(dir,'drawings.pdf'),join(dir,'drawings.zip')],{encoding:'utf8',maxBuffer:5e6});assert.equal(parsed.status,0,parsed.stderr||'Install PyMuPDF for drawing file validation.');const info=JSON.parse(parsed.stdout);assert.equal(info.pages,r.sheets.length);assert.equal(info.sheets,r.sheets.length);near(info.size[2],297*72/25.4,.001);near(info.size[3],210*72/25.4,.001);assert.match(info.text,/Café Δ – mounting plate/);assert.match(info.text,/100.00/);assert.equal(info.images,1);assert.equal(info.name,p.parts[0].name);assert.match(drawingSVG(r.sheets[0]),/data:image\/png;base64/);}
 finally{await rm(dir,{recursive:true,force:true});}
});
