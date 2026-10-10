import * as T from 'three';
import {interfaceCategories,interfaceDefinitions} from './interface-catalog.js';
export {interfaceDefinitions};
const span=s=>s?.type==='circle'?[s.d,s.d]:[s?.w||10,s?.h||10];
export const INTERFACE_CATALOG=interfaceDefinitions.map(d=>{
 const a=span(d.front),b=span(d.rear),dims=[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.max(2,d.depth+2)];
 return {key:'ib-'+d.id,name:d.name,category:new Map(interfaceCategories).get(d.category)||'InterfaceBench',kind:'interface',dims,color:d.color||'#637c71',material:d.category==='carriers'?'pcb':'plastic',origin:'cots',catalogSource:'InterfaceBench',tags:[...d.tags||[],d.category],interfaceId:d.id,params:{},source:d.source||'',notes:d.notes||'',manufacturer:d.manufacturer||'',partNumber:d.partNumber||'',anchors:(d.terminals||[]).map((a,i)=>({id:a.id,name:a.name+' (layout point)',pos:[(i-(d.terminals.length-1)/2)*Math.min(2.54,dims[0]/(d.terminals.length+1)),0,-dims[2]/2]}))};
});
const specs=[
 ['gear','Spur gear','gear',[40,40,8],{teeth:20,bore:0.15}],['pinion','Pinion gear','gear',[20,20,10],{teeth:10,bore:.2}],['rack','Toothed rack','rack',[160,12,12],{teeth:32}],
 ['rail','Linear guide rail','rail',[200,15,12],{}],['carriage','Linear rail carriage','carriage',[45,35,18],{}],['actuator','Electric linear actuator','actuator',[140,35,35],{}],['cylinder-actuator','Pneumatic cylinder','actuator',[120,30,30],{}],['solenoid','Push / pull solenoid','actuator',[50,22,22],{}],
 ['leadscrew','Lead screw','screw',[12,12,200],{turns:32}],['screw-nut','Lead screw nut','nut',[28,28,15],{bore:.4}],['pulley','Timing belt pulley','gear',[32,32,15],{teeth:20,bore:.2}],['shaft-coupling','Shaft coupling','nut',[25,25,30],{bore:.3}],['pillow-bearing','Pillow block bearing','carriage',[60,30,35],{}],
 ['hinge','Butt hinge','hinge',[50,40,4],{}],['clevis','Clevis bracket','clevis',[30,25,35],{}],['linkage','Linkage arm','link',[80,15,5],{}],['spring','Compression spring','spring',[20,20,50],{turns:8}],['servo-horn','Servo horn','link',[35,10,4],{}],['handwheel','Machine handwheel','gear',[80,80,15],{teeth:6,bore:.16}],['motor-nema','Stepper motor with shaft','motor',[42,42,65],{}]
];
export const MECHANICAL_CATALOG=specs.map(([key,name,shape,dims,params])=>({key:'mech-'+key,name,category:'Motion components',kind:shape==='motor'?'motor':'mechanism',dims,color:'#8b9d9e',material:'steel',origin:'cots',catalogSource:'MOCKUPBENCH',tags:[shape,'mechanism','motion'],params:{shape,...params},notes:'Illustrative geometry. Gear teeth are a visual approximation, not a manufacturing tooth profile.'}));
export function addComponentGeometry(g,p,materials){
 if(!['interface','mechanism'].includes(p.kind))return false;
 const [main,dark,silver]=materials;
 const mesh=(geometry,mat=main,x=0,y=0,z=0)=>{const o=new T.Mesh(geometry,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
 const box=(w,d,h,x=0,y=0,z=0,m=main)=>mesh(new T.BoxGeometry(w,d,h),m,x,y,z);
 const cyl=(w,d,h,x=0,y=0,z=0,m=main)=>{const geo=new T.CylinderGeometry(.5,.5,1,48);geo.rotateX(Math.PI/2);geo.scale(w,d,h);return mesh(geo,m,x,y,z);};
 const extrude=(shape,h)=>{const geo=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:48});geo.translate(0,0,-h/2);return geo;};
 if(p.kind==='interface'){
  const def=interfaceDefinitions.find(d=>d.id===p.interfaceId);if(!def){box(1,1,1);return true;}
  const front=span(def.front),rear=span(def.rear),full=[Math.max(front[0],rear[0]),Math.max(front[1],rear[1])];
  (def.rear.type==='circle'?cyl:box)(rear[0]/full[0],rear[1]/full[1],.82,0,0,-.09,dark);
  (def.front.type==='circle'?cyl:box)(front[0]/full[0],front[1]/full[1],.18,0,0,.41);
  const cat=def.category;
  if(cat==='displays'){box(front[0]/full[0]*.8,front[1]/full[1]*.72,.006,0,0,.497,new T.MeshStandardMaterial({color:'#63958c',roughness:.24}));}
  if(cat==='rotary'){box(.06,.32,.006,0,.14,.497,silver);}
  if(['buttons','indicators'].includes(cat)){(def.front.type==='circle'?cyl:box)(front[0]/full[0]*.68,front[1]/full[1]*.68,.006,0,0,.497,silver);}
  if(['data','audio','power'].includes(cat)){box(.58,.46,.006,0,0,.497,dark);for(let i=0;i<Math.min(12,def.terminals.length);i++)cyl(.025,.025,.008,(i%6-2.5)*.065,(Math.floor(i/6)-.5)*.1,.496,silver);}
  return true;
 }
 const q=p.params||{},shape=q.shape;
 if(shape==='gear'||shape==='nut'){
  const profile=new T.Shape(),n=shape==='gear'?(q.teeth||20)*4:64;
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,r=shape==='gear'?(i%4===0||i%4===3?.41:.5):.5;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?profile.lineTo(x,y):profile.moveTo(x,y);}profile.closePath();const hole=new T.Path();hole.absarc(0,0,(q.bore||.2)/2,0,Math.PI*2,true);profile.holes.push(hole);mesh(extrude(profile,1));
 }else if(shape==='rack'){box(1,1,.65,0,0,-.175);const n=q.teeth||32;for(let i=0;i<n;i++)box(.6/n,1,.35,(i+.5)/n-.5,0,.325);}
 else if(shape==='rail'){box(1,.62,.62,0,0,-.19);box(1,1,.38,0,0,.31);}
 else if(shape==='carriage'){box(1,1,.8,0,0,.1);box(1,.22,.2,0,-.39,-.4);box(1,.22,.2,0,.39,-.4);}
 else if(shape==='actuator'){box(.65,1,1,-.175,0,0);box(.35,.25,.25,.325,0,0,silver);}
 else if(shape==='hinge'){box(.45,1,.65,-.275,0,-.175);box(.45,1,.65,.275,0,-.175);const o=cyl(.12,.12,1,0,0,0,silver);o.rotation.x=Math.PI/2;}
 else if(shape==='clevis'){box(1,1,.2,0,0,-.4);box(.2,1,.8,-.4,0,.1);box(.2,1,.8,.4,0,.1);}
 else if(shape==='link'){box(.8,1,1);cyl(.2,1,1,-.4);cyl(.2,1,1,.4);}
 else if(shape==='screw'||shape==='spring'){
  const turns=q.turns||12,points=[];for(let i=0;i<=turns*32;i++){const a=i/32*Math.PI*2;points.push(new T.Vector3(Math.cos(a)*.43,Math.sin(a)*.43,-.43+i/(turns*32)*.86));}const geo=new T.TubeGeometry(new T.CatmullRomCurve3(points),turns*32,.065,8,false);mesh(geo,silver);if(shape==='screw')cyl(.64,.64,1,0,0,0,dark);
 }else box(1,1,1);
 return true;
}
