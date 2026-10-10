import * as T from 'three';
import {editedGeometry,faceFrame} from './geometry.js';
import {worldPoint} from './assemblies.js';
const textures=new Map(),pending=new Set(),textureErrors=new Set();
export async function texturesReady(features=null){await Promise.allSettled([...pending]);if([...textureErrors].some(image=>!features||features.some(f=>f.visible&&f.image===image)))throw Error('A decal image could not be decoded. Replace it before exporting.');}
export function disposeObject(root){root.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});}
export function decorateObject(root,part,features,onLoad=()=>{}){
 const active=features.filter(f=>f.host===part.id&&f.visible);const solidFeatures=active.filter(f=>f.type!=='decal');
 if(solidFeatures.length||part.profile?.length||part.closureOps?.length){const geometry=editedGeometry(part,solidFeatures);for(const child of [...root.children]){root.remove(child);disposeObject(child);}const mat=new T.MeshStandardMaterial({color:part.color,roughness:part.material==='wood'?.85:.4,metalness:['steel','aluminum'].includes(part.material)?.65:0});const mesh=new T.Mesh(geometry,mat);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 for(const f of active.filter(f=>f.type==='decal'&&f.image)){
  let texture=textures.get(f.image);if(!texture){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});pending.add(promise);promise.catch(()=>{});texture=new T.TextureLoader().load(f.image,()=>{pending.delete(promise);resolve();onLoad();},undefined,err=>{pending.delete(promise);textureErrors.add(f.image);reject(err);onLoad();});texture.colorSpace=T.SRGBColorSpace;textures.set(f.image,texture);}
  const plane=new T.Mesh(new T.PlaneGeometry(f.w,f.h),new T.MeshBasicMaterial({map:texture,transparent:true,opacity:f.opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,side:T.FrontSide}));
  const frame=faceFrame(part.dims,f.face);const m=frame.matrix.clone().multiply(new T.Matrix4().makeTranslation(f.u,f.v,.05)).multiply(new T.Matrix4().makeRotationZ(f.angle*Math.PI/180));plane.applyMatrix4(m);plane.userData.decal=true;plane.userData.featureId=f.id;plane.renderOrder=3;plane.name=f.name||'Decal';root.add(plane);
 }
 root.traverse(o=>{if(o.isMesh)o.userData.partId=part.id;});return root;
}
export function wireObject(project,wire){
 const points=wire.points.map(pt=>worldPoint(project,pt)),path=new T.CurvePath();for(let i=1;i<points.length;i++)if(points[i].distanceTo(points[i-1])>1e-7)path.add(new T.LineCurve3(points[i-1],points[i]));const root=new T.Group();root.name=wire.name;root.userData.cable=true;if(!path.curves.length)return root;
 const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:wire.sleeve==='braid'?.95:.6,...extra});
 const conductors=(wire.conductors||[]).slice(0,16),sleeve=wire.sleeve||'none';
 if(!conductors.length||sleeve!=='none')root.add(new T.Mesh(new T.TubeGeometry(path,Math.max(8,points.length*8),wire.diameter/2,8,false),material(wire.color,conductors.length?{transparent:true,opacity:sleeve==='ribbon'?.18:.48,depthWrite:false}:{})));
 if(conductors.length){const tangent=points.at(-1).clone().sub(points[0]).normalize();if(tangent.length()<.1)tangent.copy(points[1]).sub(points[0]).normalize();const u=new T.Vector3(Math.abs(tangent.z)<.9?0:1,0,Math.abs(tangent.z)<.9?1:0).cross(tangent).normalize(),v=new T.Vector3().crossVectors(tangent,u);const radius=wire.diameter/(Math.max(3,Math.ceil(Math.sqrt(conductors.length))+2)*2);conductors.forEach((c,i)=>{const offset=sleeve==='ribbon'?u.clone().multiplyScalar((i-(conductors.length-1)/2)*wire.diameter/Math.max(conductors.length,1)*.8):u.clone().multiplyScalar(conductors.length===1?0:Math.cos(i/conductors.length*Math.PI*2)*wire.diameter*.28).addScaledVector(v,conductors.length===1?0:Math.sin(i/conductors.length*Math.PI*2)*wire.diameter*.28);const curve=new T.CurvePath();for(let n=1;n<points.length;n++)if(points[n].distanceTo(points[n-1])>1e-7)curve.add(new T.LineCurve3(points[n-1].clone().add(offset),points[n].clone().add(offset)));const mesh=new T.Mesh(new T.TubeGeometry(curve,Math.max(8,points.length*8),radius,6,false),material(c.color));mesh.name=c.label;root.add(mesh);});}
 return root;
}

export function labelSprite(text){const cv=document.createElement('canvas');cv.width=512;cv.height=72;const cx=cv.getContext('2d');cx.fillStyle='rgba(20,45,34,.86)';cx.fillRect(0,0,512,72);cx.fillStyle='#ffffff';cx.font='24px sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(text.slice(0,45),256,36,490);const texture=new T.CanvasTexture(cv);const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false}));sprite.scale.set(80,11.25,1);sprite.userData.ownedTexture=true;sprite.renderOrder=100;return sprite;}
