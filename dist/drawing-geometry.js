import * as T from 'three';
import {partObject} from './scene.js';
import {decorateObject,disposeObject} from './rendering.js';
import {evaluatePose,matrix} from './motion.js';

export const DRAWING_VIEWS={top:{name:'Top',u:[1,0,0],v:[0,1,0],n:[0,0,1]},bottom:{name:'Bottom',u:[1,0,0],v:[0,-1,0],n:[0,0,-1]},left:{name:'Left',u:[0,-1,0],v:[0,0,1],n:[-1,0,0]},right:{name:'Right',u:[0,1,0],v:[0,0,1],n:[1,0,0]},front:{name:'Front',u:[1,0,0],v:[0,0,1],n:[0,-1,0]},back:{name:'Back',u:[-1,0,0],v:[0,0,1],n:[0,1,0]},iso:{name:'Isometric',u:[Math.SQRT1_2,Math.SQRT1_2,0],v:[-1/Math.sqrt(6),1/Math.sqrt(6),2/Math.sqrt(6)],n:[1/Math.sqrt(3),-1/Math.sqrt(3),1/Math.sqrt(3)]}};
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const projectPoint=(point,view)=>[dot(point,view.u),dot(point,view.v),dot(point,view.n)];
export function envelopeCorners(part){const m=matrix(part.pos,part.rot);return Array.from({length:8},(_,i)=>new T.Vector3(...part.dims.map((d,k)=>(i>>k&1?1:-1)*d/2)).applyMatrix4(m).toArray());}
export function extent(points){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}return {min,max,size:max.map((n,i)=>n-min[i])};}
export function bodyGeometry(part,features=[]){
 const root=partObject({...part,visible:true}),triangles=[],edges=[],silhouettes=[];
 try{decorateObject(root,part,features.filter(f=>f.type!=='decal'));root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,index=o.geometry.index,n=index?index.count:p.count,point=i=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(o.matrixWorld).toArray(),adjacent=new Map(),key=p=>p.map(n=>Math.round(n*1e6)).join(',');
  for(let i=0;i<n;i+=3){const triangle=[point(i),point(i+1),point(i+2)];triangles.push(triangle);const normal=new T.Vector3(...triangle[1]).sub(new T.Vector3(...triangle[0])).cross(new T.Vector3(...triangle[2]).sub(new T.Vector3(...triangle[0]))).normalize().toArray();
   for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3],ka=key(a),kb=key(b),id=ka<kb?ka+'|'+kb:kb+'|'+ka,prior=adjacent.get(id);if(prior){const alignment=dot(normal,prior);if(alignment>Math.cos(18*Math.PI/180)&&alignment<1-1e-8)silhouettes.push({points:[a,b],normals:[normal,prior]});adjacent.delete(id);}else adjacent.set(id,normal);}
  }
  const g=new T.EdgesGeometry(o.geometry,18),e=g.attributes.position;for(let i=0;i<e.count;i+=2)edges.push([new T.Vector3().fromBufferAttribute(e,i).applyMatrix4(o.matrixWorld).toArray(),new T.Vector3().fromBufferAttribute(e,i+1).applyMatrix4(o.matrixWorld).toArray()]);g.dispose();});return {part,triangles,edges,silhouettes};}finally{disposeObject(root);}
}
export async function drawingBodies(project,options,{signal,onProgress=()=>{}}={}){
 const pose=evaluatePose(project),parts=[...(project.enclosure.enabled?pose.panelPoses:[]),...pose.parts.filter(p=>p.kind!=='space'&&(options.includeHidden||p.visible))];if(!parts.length)throw Error('Add a part or enable the enclosure before exporting drawings.');const bodies=[];
 for(let i=0;i<parts.length;i++){signal?.throwIfAborted();const part=parts[i],ref=part.id.startsWith('@')?'E'+String(pose.panelPoses.findIndex(p=>p.id===part.id)+1).padStart(2,'0'):'P'+String(project.parts.findIndex(p=>p.id===part.id)+1).padStart(2,'0');bodies.push({...bodyGeometry(part,project.features),ref});onProgress(`Preparing geometry ${i+1} / ${parts.length}`);if(i%3===0)await new Promise(r=>setTimeout(r,0));}return {bodies,pose};
}
// Orthographic depth buffer classifies edges without WebGL. Surface gradients evaluate
// depth at each exact edge sample, avoiding false hidden runs from pixel rounding.
export function projectGeometry(bodies,key,{hiddenLines=true,resolution=900,shaded=false}={}){
 const view=typeof key==='string'?DRAWING_VIEWS[key]:key,triangles=bodies.flatMap(b=>b.triangles.map(t=>t.map(p=>projectPoint(p,view)))),bounds=extent(triangles.flat());
 if(!triangles.length)throw Error('The drawing has no geometry.');const span=Math.max(bounds.size[0],bounds.size[1],.01),scale=(resolution-4)/span,w=Math.max(8,Math.ceil(bounds.size[0]*scale)+4),h=Math.max(8,Math.ceil(bounds.size[1]*scale)+4),depth=new Float32Array(w*h).fill(-Infinity),gradientX=new Float32Array(w*h),gradientY=new Float32Array(w*h),pixels=shaded?new Uint8Array(w*h*3).fill(255):null,toPixel=p=>[(p[0]-bounds.min[0])*scale+2,(p[1]-bounds.min[1])*scale+2,p[2]];
 for(const triangle of triangles){const normal=new T.Vector3(...triangle[1]).sub(new T.Vector3(...triangle[0])).cross(new T.Vector3(...triangle[2]).sub(new T.Vector3(...triangle[0]))).normalize(),shade=Math.round(210+35*Math.max(0,normal.dot(new T.Vector3(-.3,.6,.74).normalize())));const [a,b,c]=triangle.map(toPixel),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-8)continue;const gx=((b[1]-c[1])*(a[2]-c[2])+(c[1]-a[1])*(b[2]-c[2]))/den,gy=((c[0]-b[0])*(a[2]-c[2])+(a[0]-c[0])*(b[2]-c[2]))/den,x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],c[1])));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const l=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,m=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;if(l<-.001||m<-.001||l+m>1.001)continue;const z=l*a[2]+m*b[2]+(1-l-m)*c[2],idx=y*w+x;if(z>depth[idx]){depth[idx]=z;gradientX[idx]=gx;gradientY[idx]=gy;if(pixels){const pixel=((h-1-y)*w+x)*3;pixels[pixel]=pixels[pixel+1]=pixels[pixel+2]=shade;}}}}
 const lines=[],epsilon=span/resolution*.65;
 for(const body of bodies)for(const edge of [...body.edges,...(body.silhouettes||[]).filter(e=>{const a=dot(e.normals[0],view.n),b=dot(e.normals[1],view.n);return (a>1e-8&&b<=1e-8)||(b>1e-8&&a<=1e-8);}).map(e=>e.points)]){const [a,b]=edge.map(p=>projectPoint(p,view)),length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1e-6)continue;const steps=Math.max(1,Math.min(1200,Math.ceil(length*scale/2))),point=t=>a.map((n,i)=>n+(b[i]-n)*t);let start=0,last=null;
  for(let i=0;i<steps;i++){const p=point((i+.5)/steps),px=toPixel(p),x=Math.max(0,Math.min(w-1,Math.round(px[0]))),y=Math.max(0,Math.min(h-1,Math.round(px[1]))),idx=y*w+x,occluder=depth[idx]+gradientX[idx]*(px[0]-x)+gradientY[idx]*(px[1]-y),hidden=p[2]<occluder-epsilon;if(last!==null&&last!==hidden){if(!last||hiddenLines)lines.push({points:[point(start),point(i/steps)],hidden:last,ref:body.ref});start=i/steps;}last=hidden;}
  if(!last||hiddenLines)lines.push({points:[point(start),b],hidden:last,ref:body.ref});
 }
 const raster=pixels?{pixels,w,h,bounds:{min:[bounds.min[0]-2.5/scale,bounds.min[1]-2.5/scale],max:[bounds.min[0]+(w-2.5)/scale,bounds.min[1]+(h-2.5)/scale]}}:null;
 return {view,bounds,lines,fills:[],raster};
}
