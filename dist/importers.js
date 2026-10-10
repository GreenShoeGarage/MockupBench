import * as T from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {makePart,uid,MAX_COORDS} from './model.js';
export function meshPart(vertices,{name='Imported component',color='#7d9c90',source='',indices=null,scale=1}={}){
 const v=Array.from(vertices);if(!v.length||v.some(a=>!Number.isFinite(a)))throw Error('Mesh has invalid coordinates.');
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<v.length;i++){lo[i%3]=Math.min(lo[i%3],v[i]*scale);hi[i%3]=Math.max(hi[i%3],v[i]*scale);}
 const center=lo.map((a,i)=>(a+hi[i])/2),dims=hi.map((a,i)=>Math.max(.01,a-lo[i]));if(Math.max(...dims)>5000)throw Error('Model exceeds 5,000 mm; check units.');
 const out=[];for(const index of indices||Array.from({length:v.length/3},(_,i)=>i)){if(!Number.isInteger(index)||index<0||index*3>=v.length)throw Error('Invalid triangle index.');for(let k=0;k<3;k++)out.push((v[index*3+k]*scale-center[k])/dims[k]);}
 if(out.length%9||out.length>MAX_COORDS)throw Error('Mesh must contain complete triangles, at most 500,000.');
 return makePart('block',{kind:'mesh',category:'Imported',dims,vertices:out,pos:center,name,color,source});
}
export function stepParts(result,filename){
 if(!result.success||!result.meshes?.length)throw Error('No geometry was found in the STEP file.');
 const parts=result.meshes.map((m,i)=>meshPart(m.attributes.position.array,{indices:m.index.array,name:m.name||`${filename} / ${i+1}`,color:m.color?'#'+new T.Color(...m.color).getHexString():'#8eaaa1',source:filename}));
 const groups=[];
 function walk(node,parentId=''){const id=uid();groups.push({id,name:node.name||'Imported assembly',parentId,origin:[0,0,0],rot:[0,0,0],templateId:'',revision:0});for(const i of node.meshes||[])if(parts[i])parts[i].groupId=id;for(const c of node.children||[])walk(c,id);}
 if(result.root)walk(result.root);return {parts,groups};
}
export async function readSTEP(buffer,name,detail=.2){
 return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./import-worker.js',import.meta.url));const timeout=setTimeout(()=>{worker.terminate();reject(Error('STEP conversion timed out after 90 seconds. Try a simplified supplier model.'));},90000);worker.onmessage=e=>{clearTimeout(timeout);worker.terminate();if(e.data.error)reject(Error(e.data.error));else{try{resolve(stepParts(e.data.result,name));}catch(err){reject(err);}}};worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(Error(e.message||'STEP worker failed. Check that .wasm files are served correctly.'));};worker.postMessage({buffer,detail},[buffer]);});
}
export async function readGLB(buffer,name){
 const view=new DataView(buffer);if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw Error('Use a binary glTF 2.0 (.glb) file.');
 const jsonLength=view.getUint32(12,true);if(view.getUint32(16,true)!==0x4e4f534a)throw Error('Missing GLB JSON chunk.');const doc=JSON.parse(new TextDecoder().decode(buffer.slice(20,20+jsonLength)));
 if([...(doc.buffers||[]),...(doc.images||[])].some(a=>a.uri&&!a.uri.startsWith('data:')))throw Error('External GLB resources are not fetched. Export a self-contained GLB.');
 if((doc.extensionsRequired||[]).some(a=>/draco|meshopt|basisu/i.test(a)))throw Error('Export an uncompressed GLB; Draco/Meshopt/KTX decoders are not bundled.');
 const manager=new T.LoadingManager();manager.setURLModifier(url=>{if(!/^(data:|blob:)/.test(url))throw Error('External model resource blocked.');return url;});
 const loader=new GLTFLoader(manager);loader.register(parser=>({name:'MOCKUPBENCH_COLORS_ONLY',loadTexture:()=>Promise.resolve(null)}));const gltf=await loader.parseAsync(buffer,'');gltf.scene.updateMatrixWorld(true);const parts=[];
 gltf.scene.traverse(o=>{if(!o.isMesh)return;let g=o.geometry.clone();if(g.index)g=g.toNonIndexed();g.applyMatrix4(o.matrixWorld);g.rotateX(Math.PI/2);const a=g.attributes.position.array;const color=Array.isArray(o.material)?o.material[0]?.color:o.material?.color;parts.push(meshPart(a,{name:o.name||`${name} / ${parts.length+1}`,color:color?'#'+color.getHexString():'#8eaaa1',source:name,scale:1000}));g.dispose();});
 gltf.scene.traverse(o=>{o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)if(m){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}});
 if(!parts.length)throw Error('No mesh geometry in GLB.');return {parts,groups:[]};
}
export const SUPPLIERS={
 'McMaster-Carr':{search:q=>'https://www.mcmaster.com/'+encodeURIComponent(q)+'/',host:'mcmaster.com'},
 'DigiKey':{search:q=>'https://www.digikey.com/en/products?keywords='+encodeURIComponent(q),host:'digikey.com'},
 'Mouser':{search:q=>'https://www.mouser.com/c/?q='+encodeURIComponent(q),host:'mouser.com'}
};
export function productURL(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
