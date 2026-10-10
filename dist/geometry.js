import * as T from 'three';
import Factory from './vendor/manifold.js';
import {FontLoader} from './vendor/FontLoader.js';
import {fonts} from './vendor/fonts.js';
import {applyClosure} from './enclosure.js';
let kernel;const fontObjects=Object.fromEntries(Object.entries(fonts).map(([k,v])=>[k,new FontLoader().parse(v)]));
export async function initGeometry(options={}){if(!kernel){kernel=await Factory({...options,locateFile:name=>new URL('./vendor/'+name,import.meta.url).href});kernel.setup();}return kernel;}
export const getKernel=()=>kernel;
export const FACES=['top','bottom','front','back','left','right'];
export function faceFrame(dims,face='top'){
 const [w,d,h]=dims;const f={top:[[1,0,0],[0,1,0],[0,0,1],[0,0,h/2],[w,d],h],bottom:[[1,0,0],[0,-1,0],[0,0,-1],[0,0,-h/2],[w,d],h],front:[[1,0,0],[0,0,1],[0,-1,0],[0,-d/2,0],[w,h],d],back:[[-1,0,0],[0,0,1],[0,1,0],[0,d/2,0],[w,h],d],left:[[0,-1,0],[0,0,1],[-1,0,0],[-w/2,0,0],[d,h],w],right:[[0,1,0],[0,0,1],[1,0,0],[w/2,0,0],[d,h],w]}[face];
 const [u,v,n,origin,span,thickness]=f;return {u,v,n,origin,span,thickness,matrix:new T.Matrix4().makeBasis(new T.Vector3(...u),new T.Vector3(...v),new T.Vector3(...n)).setPosition(...origin)};
}
export function panels(e){const {w,d,h,t}=e;return applyClosure(e,[
 {id:'@Base',name:'Base',dims:[w,d,t],pos:[0,0,t/2],face:'bottom'},
 {id:'@Left',name:'Left',dims:[t,d,h-2*t],pos:[-w/2+t/2,0,h/2],face:'left'},
 {id:'@Right',name:'Right',dims:[t,d,h-2*t],pos:[w/2-t/2,0,h/2],face:'right'},
 {id:'@Front',name:'Front',dims:[w-2*t,t,h-2*t],pos:[0,-d/2+t/2,h/2],face:'front'},
 {id:'@Back',name:'Back',dims:[w-2*t,t,h-2*t],pos:[0,d/2-t/2,h/2],face:'back'},
 {id:'@Lid',name:'Lid',dims:[w,d,t],pos:[0,0,h-t/2],face:'top'}].map(p=>({...p,rot:[0,0,0],kind:'block',material:e.material,color:e.color,profile:[],visible:true})));}
export function profileBounds(contours){const pts=contours.flat();if(!pts.length)return {min:[0,0],max:[0,0],size:[0,0]};const min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const p of pts)for(let i=0;i<2;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}return {min,max,size:max.map((x,i)=>x-min[i])};}
export function normalizedContours(contours){const b=profileBounds(contours);if(Math.min(...b.size)<1e-6)throw Error('Profile needs width and height.');return contours.map(c=>c.map(p=>p.map((n,i)=>(n-(b.min[i]+b.max[i])/2)/b.size[i])));}
export function baseContours(f){
 const w=f.w,h=f.h;
 if(f.type==='emboss'||f.type==='deboss'||f.shape==='text'){
  const font=fontObjects[f.font||'sans'],size=f.fontSize||8,loops=[];let x=0,y=0;
  for(const char of (f.text||'LABEL')){if(char==='\n'){x=0;y-=size*1.5;continue;}if(!font.data.glyphs[char])throw Error('The selected font has no glyph for '+char+'. Choose another font or import SVG outlines.');const shapes=font.generateShapes(char,size);for(const shape of shapes){loops.push(shape.getPoints(8).map(p=>[p.x+x,p.y+y]));for(const hole of shape.holes)loops.push(hole.getPoints(8).map(p=>[p.x+x,p.y+y]));}const glyph=font.data.glyphs[char]||font.data.glyphs['?'];x+=(glyph?.ha||font.data.resolution)*size/font.data.resolution*(f.spacing||1);}
  const b=profileBounds(loops);const dx=f.align==='left'?b.min[0]:f.align==='right'?b.max[0]:(b.min[0]+b.max[0])/2;return loops.map(c=>c.map(p=>[p[0]-dx,p[1]-(b.min[1]+b.max[1])/2]));
 }
 if(f.shape==='svg'||f.shape==='polygon'){let loops=f.shape==='svg'?f.contours:[f.points];if(!loops?.[0]?.length)throw Error('Draw or import a profile first.');return normalizedContours(loops).map(c=>c.map(([x,y])=>[x*w,y*h]));}
 if(f.shape==='ellipse')return [Array.from({length:64},(_,i)=>[Math.cos(i*Math.PI/32)*w/2,Math.sin(i*Math.PI/32)*h/2])];
 if(['slot','roundrect'].includes(f.shape)){const r=f.shape==='slot'?Math.min(w,h)/2:Math.min(f.radius,w/2,h/2);const pts=[];for(const [cx,cy,start] of [[w/2-r,h/2-r,0],[-w/2+r,h/2-r,90],[-w/2+r,-h/2+r,180],[w/2-r,-h/2+r,270]])for(let i=0;i<=12;i++){const a=(start+i*90/12)*Math.PI/180;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}return [pts];}
 return [[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]];
}
export function featureContours(f){const loops=baseContours(f),out=[],a=f.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);for(let row=0;row<f.rows;row++)for(let col=0;col<f.cols;col++){const du=(col-(f.cols-1)/2)*f.pitchU,dv=(row-(f.rows-1)/2)*f.pitchV;for(const loop of loops)out.push(loop.map(([x,y])=>[(x+du)*c-(y+dv)*s+f.u,(x+du)*s+(y+dv)*c+f.v]));}return out;}
function consumeTransform(s,method,...args){const out=s[method](...args);s.delete();return out;}
function baseSolid(part){
 if(!kernel)throw Error('Solid geometry engine is still loading.');const {Manifold,Mesh,CrossSection}=kernel,[w,d,h]=part.dims;
 if(part.profile?.length){const cs=new CrossSection([part.profile.map(([x,y])=>[x*w,y*d])],'EvenOdd');let s=cs.extrude(h);cs.delete();return consumeTransform(s,'translate',[0,0,-h/2]);}
 if(part.kind==='mesh'){const vertices=part.vertices.map((n,i)=>n*part.dims[i%3]);const mesh=new Mesh({numProp:3,vertProperties:new Float32Array(vertices),triVerts:new Uint32Array(Array.from({length:vertices.length/3},(_,i)=>i)),tolerance:1e-5});mesh.merge();const s=new Manifold(mesh);if(s.status()!=='NoError'){s.delete();throw Error('Imported mesh is not a closed solid. Surface decoration is available; solid cuts require a closed mesh.');}return s;}
 if(['cylinder','motor'].includes(part.kind)){let s=Manifold.cylinder(h,w/2,w/2,64,true);return consumeTransform(s,'scale',[1,d/w,1]);}
 if(part.kind==='bracket'){let a=consumeTransform(Manifold.cube([w,d,h*.08],true),'translate',[0,0,-h*.46]),b=consumeTransform(Manifold.cube([w,d*.08,h*.92],true),'translate',[0,d*.46,h*.04]);const s=a.add(b);a.delete();b.delete();return s;}
 return Manifold.cube(part.dims,true);
}
export function primitiveSolid(part){let solid=baseSolid(part);try{for(const op of part.closureOps||[]){let tool;
 if(op.shape==='cylinder')tool=consumeTransform(kernel.Manifold.cylinder(op.size[2],op.size[0]/2,op.size[0]/2,64,true),'scale',[1,op.size[1]/op.size[0],1]);
 else if(op.shape==='ramp'){const [w,h,d]=op.size,cs=new kernel.CrossSection([[[-w/2,-h/2],[w/2,h/2],[-w/2,h/2]]]);tool=cs.extrude(d);cs.delete();tool=consumeTransform(tool,'translate',[0,0,-d/2]);}
 else tool=kernel.Manifold.cube(op.size,true);
 tool=consumeTransform(tool,'rotate',op.rot);tool=consumeTransform(tool,'translate',op.pos);const next=op.operation==='add'?solid.add(tool):solid.subtract(tool);tool.delete();solid.delete();solid=next;if(solid.isEmpty()||solid.status()!=='NoError')throw Error('Invalid enclosure closure geometry. Adjust the closure dimensions.');
 }return solid;}catch(err){solid.delete();throw err;}}
export function featureSolid(f,dims){const {CrossSection}=kernel,frame=faceFrame(dims,f.face),loops=featureContours(f);if(!loops.length)throw Error('The text/profile has no geometry.');if((f.type==='deboss'||f.type==='cutout'&&!f.through)&&f.depth>=frame.thickness)throw Error('Pocket/deboss depth must be less than host thickness.');const cs=new CrossSection(loops,'EvenOdd');const emboss=f.type==='emboss',depth=emboss?f.depth+.025:f.through&&f.type==='cutout'?frame.thickness+.05:f.depth+.025;let s=cs.extrude(depth);cs.delete();s=consumeTransform(s,'translate',[0,0,emboss?-.025:-depth+.025]);s=consumeTransform(s,'transform',frame.matrix.elements);return s;}
export function editedSolid(part,features){let solid=primitiveSolid(part);try{for(const f of features.filter(f=>f.visible&&f.type!=='decal')){const tool=featureSolid(f,part.dims);const next=f.type==='emboss'?solid.add(tool):solid.subtract(tool);tool.delete();solid.delete();solid=next;if(solid.isEmpty())throw Error('This feature removes the entire host.');if(solid.status()!=='NoError')throw Error('Solid operation failed: '+solid.status());}return solid;}catch(err){solid.delete();throw err;}}
export function solidGeometry(s){const m=s.getMesh(),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(m.vertProperties,3));g.setIndex(new T.BufferAttribute(new Uint32Array(m.triVerts),1));g.computeVertexNormals();return g;}
const geometryCache=new Map(),meshKeys=new WeakMap();let meshKey=0;
function meshIdentity(part){if(!part.vertices)return '';if(!meshKeys.has(part.vertices))meshKeys.set(part.vertices,++meshKey);return meshKeys.get(part.vertices);}
export function editedGeometry(part,features){const key=JSON.stringify([part.kind,part.dims,part.profile,part.closureOps,part.kind==='mesh'?meshIdentity(part):'',features]);if(geometryCache.has(key))return geometryCache.get(key).clone();const s=editedSolid(part,features);const g=solidGeometry(s);s.delete();geometryCache.set(key,g);while(geometryCache.size>50){const [k,v]=geometryCache.entries().next().value;v.dispose();geometryCache.delete(k);}return g.clone();}
export function checkFeatures(part,features){const out=[];for(const f of features){if(!f.visible)continue;const fr=faceFrame(part.dims,f.face),b=profileBounds(f.type==='decal'?featureContours({...f,shape:'rectangle'}):featureContours(f));if(b.min[0]<-fr.span[0]/2||b.max[0]>fr.span[0]/2||b.min[1]<-fr.span[1]/2||b.max[1]>fr.span[1]/2)out.push(`${f.name||f.type}: extends beyond the selected face.`);if((f.type==='deboss'||f.type==='cutout'&&!f.through)&&f.depth>=fr.thickness)out.push(`${f.name||f.type}: depth reaches through the host.`);}return out;}
