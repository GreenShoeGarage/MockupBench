import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import * as T from 'three';
import {freshProject,makePart,validateProject} from '../dist/model.js';
import {normalizeFeature} from '../dist/schema.js';
import {initGeometry} from '../dist/geometry.js';
import {createMovieModel,polishMovieMaterials} from '../dist/cinematic.js';
import {movieDefaults,movieState,movieChapters,movieFrames,movieFrameTime,normalizeMovieOptions} from '../dist/movie.js';
import {MP4EncoderClient,encodeMovieFrames} from '../dist/video-encoder.js';
await initGeometry({wasmBinary:await readFile(new URL('../dist/vendor/manifold.wasm',import.meta.url))});
const near=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
test('movie sequence begins closed, completes two full turns and reassembles without discontinuities',()=>{
 for(const duration of [20,40,60]){const o={...movieDefaults(),duration},chapters=movieChapters(duration);near(chapters.at(-1).end,duration);const first=movieState(0,o),last=movieState(duration,o);assert.equal(first.opacity,1);assert.equal(first.explode,0);assert.equal(last.opacity,1);assert.equal(last.explode,0);assert.equal(last.hero,1);
  for(const i of [2,4]){const start=movieState(chapters[i].start,o),end=movieState(chapters[i].end,o);near(end.azimuth-start.azimuth,2*Math.PI);if(i===2)near(start.opacity,o.ghostOpacity);else near(start.explode,o.explosion);}
  for(const c of chapters.slice(0,-1)){const a=movieState(c.end-1e-7,o),b=movieState(c.end,o);for(const k of ['opacity','explode','azimuth','hero'])near(a[k],b[k]);}
  for(const fps of [24,30]){const opt={...o,fps};assert.equal(movieFrames(opt),duration*fps);near(movieFrameTime(0,opt),0);near(movieFrameTime(movieFrames(opt)-1,opt),duration);}
 }
});
test('movie options migrate, round trip and reject invalid dimensions/timing',()=>{
 const p=freshProject();delete p.movie;assert.deepEqual(validateProject(p).movie,movieDefaults());p.movie={...movieDefaults(),duration:25,resolution:'720',includeHidden:false};assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))).movie,p.movie);for(const invalid of [{duration:0},{duration:NaN},{fps:60},{resolution:'4k'},{elevation:90},{ghostOpacity:1}])assert.throws(()=>normalizeMovieOptions(invalid));
});
test('presentation geometry retains solid features, starts at rest, and never mutates the working project',()=>{
 const p=freshProject(),a=makePart('block',{pos:[30,0,40],dims:[80,60,10]}),hidden=makePart('display',{visible:false}),space=makePart('space');p.parts=[a,hidden,space];p.features=[normalizeFeature({id:'cut',host:a.id,w:10,h:10})];p.joints=[{id:'not-applied-to-movie',body:a.id,value:90}];p.wires=[{id:'cable',points:[{host:a.id,pos:[0,0,0]},{host:'',pos:[550,0,50]}],diameter:3,color:'#cc4411',slack:0}];const original=JSON.stringify(p),o=movieDefaults(),m=createMovieModel(p,o);polishMovieMaterials(m,null);
 assert.equal(m.entries.length,8);assert.equal(m.entries.filter(e=>e.part.kind==='space').length,0);assert.ok(m.assembled.max.x>549);assert.deepEqual(m.entries.find(e=>e.part.id===a.id).object.position.toArray(),a.pos);let positions,geometry;m.entries.find(e=>e.part.id===a.id).object.traverse(n=>{if(n.isMesh){geometry=n.geometry;positions=n.geometry.index?.count||n.geometry.getAttribute('position').count;}});assert.ok(positions>36,'cutout uses actual solid geometry');const base=m.entries.find(e=>e.part.id==='@Base'),lid=m.entries.find(e=>e.part.id==='@Lid'),basePos=base.object.position.clone(),lidPos=lid.object.position.clone();
 m.apply(movieState(10,o));lid.object.traverse(n=>{if(n.isMesh)near(n.material.opacity,o.ghostOpacity);});assert.equal(m.wires.visible,true);
 m.apply(movieState(22,o));assert.ok(base.object.position.equals(basePos));assert.ok(lid.object.position.z>lidPos.z);assert.equal(m.wires.visible,false);m.entries.find(e=>e.part.id===a.id).object.traverse(n=>{if(n.isMesh)assert.equal(n.geometry,geometry);});
 m.apply(movieState(40,o));assert.ok(lid.object.position.equals(lidPos));lid.object.traverse(n=>{if(n.isMesh)assert.equal(n.material.opacity,1);});assert.equal(m.wires.visible,true);assert.equal(JSON.stringify(p),original);m.dispose();const visible=createMovieModel(p,{...o,includeHidden:false});assert.equal(visible.entries.length,7);visible.dispose();p.enclosure.enabled=false;p.parts=[];assert.throws(()=>createMovieModel(p,o),/Add physical/);
});
test('worker client terminates on cancellation and rejects pending frames',async()=>{
 class Worker{constructor(){Worker.instance=this;}postMessage(m){this.message=m;}terminate(){this.terminated=true;}}
 const abort=new AbortController(),encoder=new MP4EncoderClient({WorkerClass:Worker,signal:abort.signal}),request=encoder.request('init');abort.abort();await assert.rejects(request,{name:'AbortError'});assert.equal(Worker.instance.terminated,true);assert.equal(encoder.pending.size,0);await assert.rejects(encoder.request('frame'),{name:'AbortError'});
 const next=new MP4EncoderClient({WorkerClass:Worker}),bad=next.request('init');Worker.instance.onmessage({data:{id:1,error:'WASM failed'}});await assert.rejects(bad,/WASM failed/);next.close();
});
test('frame pump encodes the entire timeline in order, bounds memory and cleans up errors',async()=>{
 const options={...movieDefaults(),duration:20,fps:24,resolution:'720'},bytes=1280*720*4,buffer=new Uint8Array(bytes+8),rgba=new Uint8Array(buffer.buffer,4,bytes),times=[];let active=0,max=0,progress=0,instance;
 class Encoder{constructor(){instance=this;this.frames=0;}async request(type,payload){active++;max=Math.max(max,active);await Promise.resolve();active--;if(type==='frame'){assert.equal(payload.rgba.byteLength,bytes);this.frames++;}return type==='finish'?{frames:this.frames,bytes:new Uint8Array([1,2,3]).buffer}:{};}close(){this.closed=true;}}
 const blob=await encodeMovieFrames({options,EncoderClass:Encoder,renderFrame:t=>{times.push(t);return times.length===1?rgba:new Uint8Array(buffer.buffer,0,bytes);},onProgress:p=>progress=p.progress,yieldFrame:async()=>{}});assert.equal(blob.type,'video/mp4');assert.equal(times.length,480);assert.equal(times[0],0);assert.equal(times.at(-1),20);assert.equal(max,1);assert.equal(progress,1);assert.ok(instance.closed);
 await assert.rejects(encodeMovieFrames({options,EncoderClass:Encoder,renderFrame:()=>{throw Error('GPU unavailable');}}),/GPU unavailable/);assert.ok(instance.closed);
 const stop=new AbortController();await assert.rejects(encodeMovieFrames({options,EncoderClass:Encoder,signal:stop.signal,renderFrame:()=>{stop.abort();return rgba;}}),{name:'AbortError'});assert.ok(instance.closed);
});
test('the shipped web/WASM worker creates decodable 720p and 1080p H.264 MP4 files',async t=>{
 const [bundle,worker]=await Promise.all(['vendor/h264-mp4-encoder.web.js','mp4-worker.js'].map(f=>readFile(new URL('../dist/'+f,import.meta.url),'utf8'))),dir=await mkdtemp(join(tmpdir(),'mockupbench-mp4-'));
 try{for(const [width,height,fps,quality] of [[1280,720,24,'high'],[1920,1080,30,'standard']]){let reply,id=0;const c=vm.createContext({console,WebAssembly,TextDecoder,TextEncoder,performance,setTimeout,clearTimeout,atob,btoa,URL,Uint8Array,ArrayBuffer,location:{href:'https://offline.test/mp4-worker.js'}});c.self=c;c.postMessage=m=>reply=m;c.importScripts=path=>{assert.equal(path,'./vendor/h264-mp4-encoder.web.js');vm.runInContext(bundle,c);};vm.runInContext(worker,c);const send=async data=>{await c.onmessage({data:{id:++id,...data}});assert.equal(reply.id,id);assert.ok(!reply.error,reply.error);return reply;};await send({type:'init',width,height,fps,quality});const data=new Uint8Array(width*height*4);for(let frame=0;frame<fps;frame++){const fraction=frame/(fps-1);for(let i=0;i<data.length;i+=4){data[i]=230-220*fraction;data[i+1]=40;data[i+2]=10+220*fraction;data[i+3]=255;}await send({type:'frame',rgba:data.buffer});}const result=await send({type:'finish'});assert.equal(result.frames,fps);const buffer=Buffer.from(result.bytes);assert.equal(buffer.toString('ascii',4,8),'ftyp');const path=join(dir,width+'.mp4');await writeFile(path,buffer);
   const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,pix_fmt,width,height,r_frame_rate,duration,nb_frames','-of','json',path],{encoding:'utf8'});assert.equal(probe.status,0,probe.stderr||'Install ffmpeg for the codec verification test.');const stream=JSON.parse(probe.stdout).streams[0];assert.equal(stream.codec_name,'h264');assert.equal(stream.pix_fmt,'yuv420p');assert.equal(stream.width,width);assert.equal(stream.height,height);assert.equal(stream.r_frame_rate,fps+'/1');assert.equal(Number(stream.nb_frames),fps);near(Number(stream.duration),1);
   const decoded=spawnSync('ffmpeg',['-v','error','-i',path,'-vf',`select=eq(n\\,0)+eq(n\\,${fps-1}),scale=1:1`,'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','-']);assert.equal(decoded.status,0,decoded.stderr.toString());assert.equal(decoded.stdout.length,6);assert.ok(decoded.stdout[0]>200&&decoded.stdout[2]<30);assert.ok(decoded.stdout[3]<30&&decoded.stdout[5]>200);t.diagnostic(`${width}×${height}, ${fps} fps: ${fps} frames, H.264/yuv420p, first and last frame colors verified.`);
  }}finally{await rm(dir,{recursive:true,force:true});}
});
