import {bindTransformControls,configureTransform,cancelTransform} from './transforms.js';
import {closureOpenMatrix} from './enclosure.js';
import {addComponentGeometry} from './components.js';
import {evaluatePose,driven} from './motion.js';
import * as T from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {TransformControls} from './vendor/TransformControls.js';
import {STLLoader} from './vendor/STLLoader.js';
import {STLExporter} from './vendor/STLExporter.js';
import {GLTFExporter} from './vendor/GLTFExporter.js';
import {panels,faceFrame} from './geometry.js';
import {decorateObject,wireObject,labelSprite,texturesReady} from './rendering.js';
import {groupParts} from './assemblies.js';
import {surfaceHit} from './placement.js';

export function material(color,type='plastic',options={}){
 return new T.MeshStandardMaterial({color,roughness:type==='glass'?.18:type==='wood'?.88:.46,metalness:type==='aluminum'?.68:type==='steel'?.82:0,...options});
}
function box(group,w,d,h,x,y,z,mat){const m=new T.Mesh(new T.BoxGeometry(w,d,h),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function cylinder(group,w,d,h,x,y,z,mat){const g=new T.CylinderGeometry(.5,.5,1,40);g.rotateX(Math.PI/2);g.scale(w,d,h);const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function edge(mesh){const lines=new T.LineSegments(new T.EdgesGeometry(mesh.geometry),new T.LineBasicMaterial({color:'#354b40',transparent:true,opacity:.20}));mesh.add(lines);return mesh;}
export function partObject(p){
 const root=new T.Group();root.name=p.name;root.userData.partId=p.id;root.position.fromArray(p.pos);root.rotation.set(...p.rot.map(v=>v*Math.PI/180));root.visible=p.visible;
 const g=new T.Group();root.add(g);g.scale.fromArray(p.dims);
 const main=material(p.color,p.material),dark=material('#263432'),silver=material('#a9b3b7','aluminum'),gold=material('#cba664','steel');
 const b=(w,d,h,x=0,y=0,z=0,m=main)=>box(g,w,d,h,x,y,z,m),c=(w,d,h,x=0,y=0,z=0,m=main)=>cylinder(g,w,d,h,x,y,z,m);
 if(addComponentGeometry(g,p,[main,dark,silver])){
 }else if(p.kind==='mesh'){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p.vertices,3));geometry.computeVertexNormals();const mesh=new T.Mesh(geometry,main);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
 }else if(p.kind==='pcb'){
  edge(b(1,1,.14,0,0,-.43));b(.35,.35,.5,-.09,.02,-.11,dark);b(.21,.23,.3,.27,.19,-.2,dark);b(.23,.27,.7,-.28,-.32,-.08,silver);
  for(const y of [-.42,.42]){b(.65,.065,.35,.06,y,-.18,dark);for(let x=-.24;x<.37;x+=.09)b(.025,.035,.55,x,y,.025,gold);}
  for(const x of [-.44,.44])for(const y of [-.42,.42]){const m=c(.06,.06,.01,x,y,-.351,gold);m.castShadow=false;}
  b(.1,.14,1,.38,-.3,0,silver);
 }else if(p.kind==='display'){
  edge(b(1,1,.75,0,0,-.125));b(.86,.8,.08,0,0,.30,dark);b(.76,.65,.02,0,0,.35,material('#70918f','glass'));b(.42,.035,.015,-.08,.12,.365,material('#b1d4cc'));b(.57,.018,.015,0,-.06,.365,material('#a4c5ba'));b(.16,.09,.16,-.33,-.39,.42,silver);
 }else if(p.kind==='battery'){
  edge(b(1,1,.92,0,0,-.04));b(.65,.65,.01,0,0,.425,material('#efdfa9'));b(.13,.14,.08,-.23,.35,.46,silver);b(.13,.14,.08,.23,.35,.46,silver);b(.18,.025,.01,0,0,.435,dark);b(.025,.18,.01,0,0,.435,dark);
 }else if(p.kind==='psu'){
  edge(b(1,1,.85,0,0,-.075));b(.75,.23,.14,0,-.36,.42,material('#3a8263'));
  for(let y=-.1;y<.35;y+=.12)for(let x=-.4;x<.41;x+=.16)b(.09,.055,.003,x,y,.352,dark);
  for(let x=-.30;x<.31;x+=.15)c(.07,.07,.01,x,-.36,.495,silver);
 }else if(p.kind==='cylinder'){
  c(1,1,1);c(.82,.82,.002,0,0,.499,p.material==='wood'?main:dark);
 }else if(p.kind==='motor'){
  c(1,1,.78,0,0,-.11,silver);c(.96,.96,.08,0,0,-.46,dark);c(.17,.17,.23,0,0,.385,silver);
 }else if(p.kind==='fan'){
  b(1,.1,1,0,-.45);b(1,.1,1,0,.45);b(.1,.8,1,-.45);b(.1,.8,1,.45);c(.85,.85,.23,0,0,0,dark);c(.32,.32,.65,0,0,0,silver);
  for(let i=0;i<5;i++){const blade=b(.18,.42,.12,0,0,.2,main);blade.position.set(Math.sin(i*Math.PI*.4)*.25,Math.cos(i*Math.PI*.4)*.25,.2);blade.rotation.z=-i*Math.PI*.4+.5;}
 }else if(p.kind==='bracket'){
  edge(b(1,1,.08,0,0,-.46));edge(b(1,.08,.92,0,.46,.04));
 }else if(p.kind==='space'){
  edge(b(1,1,1,0,0,0,material(p.color,'plastic',{transparent:true,opacity:.12,depthWrite:false})));const edges=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1,1,1)),new T.LineDashedMaterial({color:p.color,dashSize:.06,gapSize:.04}));edges.computeLineDistances();g.add(edges);
 }else edge(b(1,1,1));
 root.traverse(o=>{if(o.isMesh)o.userData.partId=p.id;});return root;
}
function woodTexture(){const cv=document.createElement('canvas');cv.width=cv.height=256;const cx=cv.getContext('2d');cx.fillStyle='#d7c7a8';cx.fillRect(0,0,256,256);for(let i=0;i<160;i++){cx.strokeStyle=`rgba(65,40,12,${.025+(i%7)*.012})`;cx.lineWidth=(i%3)*.3+.3;cx.beginPath();for(let x=0;x<=256;x+=8){let y=i*1.8+Math.sin(x*.03+i*.8)*2.3+Math.sin(x*.09+i)*.6;if(x===0)cx.moveTo(x,y);else cx.lineTo(x,y);}cx.stroke();}const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;return t;}
export function applyPanelPose(object,part,e,mode,explode=0,jointed=false){object.position.fromArray(part.pos);object.rotation.set(...part.rot.map(n=>n*Math.PI/180));object.position.addScaledVector(new T.Vector3(...faceFrame(part.dims,part.face).n),explode*Math.max(e.w,e.d,e.h)*.4);if(mode==='open'&&part.id==='@Lid'&&!jointed){const m=closureOpenMatrix(e);if(m){object.updateMatrix();object.applyMatrix4(m);}}}
export function enclosureObject(e,mode='closed',explode=0,texture,features=[],onLoad=()=>{}){
 const root=new T.Group();if(!e.enabled||mode==='none')return root;
 const {w,d,h,t}=e;const m=material(e.color,e.material,{transparent:mode==='ghost',opacity:mode==='ghost'?.15:1,depthWrite:mode!=='ghost'});if(texture&&e.material==='wood')m.map=texture;
 for(const p of panels(e)){if(mode==='open'&&p.name==='Lid'&&!closureOpenMatrix(e))continue;const spread=explode*Math.max(w,d,h)*.4;const frame=faceFrame(p.dims,p.face);const g=new T.Group();g.position.fromArray(p.pos);g.position.addScaledVector(new T.Vector3(...frame.n),spread);const mesh=edge(box(g,...p.dims,0,0,0,m));g.name=`Enclosure ${p.name}`;g.userData.partId=p.id;decorateObject(g,p,features,onLoad);if(mode==='ghost')g.traverse(o=>{if(o.material){o.material.transparent=true;o.material.opacity=o.userData.decal?.6:.15;o.material.depthWrite=false;}});applyPanelPose(g,p,e,mode,explode);root.add(g);}
 return root;
}
function dispose(root){root.traverse(o=>{o.geometry?.dispose();if(o.userData.ownedTexture)o.material?.map?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
export class Studio{
 constructor(host,events){
  this.host=host;this.events=events;this.objects=new Map();this.shellMode='open';this.explode=0;this.selected=null;this.tool='orbit';this.pickMode='select';this.measureSnap='vertex';this.labels=false;this.geometryErrors=[];this.size=380;this.gridEnabled=true;
  this.scene=new T.Scene();this.scene.background=new T.Color('#e7ebe4');
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.4;this.renderer.localClippingEnabled=true;host.prepend(this.renderer.domElement);
  this.camera=new T.OrthographicCamera(-500,500,500,-500,.1,30000);this.camera.up.set(0,0,1);this.camera.position.set(700,-850,800);
  this.orbit=new OrbitControls(this.camera,this.renderer.domElement);this.orbit.enableDamping=false;this.orbit.target.set(0,0,40);this.orbit.addEventListener('change',()=>this.render());this.orbit.minZoom=.05;this.orbit.maxZoom=40;
  this.transform=new TransformControls(this.camera,this.renderer.domElement);this.transform.setSize(1);this.scene.add(this.transform.getHelper());bindTransformControls(this);
  this.scene.add(new T.AmbientLight('#e7efe8',1.0));const hemi=new T.HemisphereLight('#fff4df','#8a9d8a',2.3);hemi.position.set(0,0,1000);this.scene.add(hemi);
  const light=new T.DirectionalLight('#fff8e9',4);light.position.set(-500,-600,1000);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-1200,right:1200,top:1200,bottom:-1200,near:1,far:4000});light.shadow.bias=-.0002;light.shadow.normalBias=.3;this.scene.add(light);
  const fill=new T.DirectionalLight('#d3e6ef',1.6);fill.position.set(700,500,500);this.scene.add(fill);
  this.floor=new T.Mesh(new T.PlaneGeometry(5000,5000),new T.ShadowMaterial({opacity:.12}));this.floor.position.z=-2;this.floor.receiveShadow=true;this.scene.add(this.floor);
  this.grid=new T.GridHelper(1000,100,'#b6c7b9','#d0d9ce');this.grid.rotation.x=Math.PI/2;this.grid.position.z=-1;this.grid.material.transparent=true;this.grid.material.opacity=.5;this.scene.add(this.grid);
  this.axis=new T.AxesHelper(45);this.axis.position.set(-160,-120,.1);this.scene.add(this.axis);
  this.wood=woodTexture();this.content=new T.Group();this.scene.add(this.content);this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
  let start;
  this.renderer.domElement.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};});
  this.renderer.domElement.addEventListener('pointerup',e=>{if(this.placing||!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5||this.dragged||this.transform.axis)return;const rect=host.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hits=this.ray.intersectObjects([...this.objects.values()].filter(o=>o.visible),true);const found=hits.find(h=>h.object.userData.partId&&h.face&&h.object.isMesh);if(!found)return;
   const id=found.object.userData.partId,root=this.objects.get(id),localNormal=found.face.normal.clone().transformDirection(found.object.matrixWorld).applyQuaternion(root.getWorldQuaternion(new T.Quaternion()).invert());const axes=['right','back','top'],opposite=['left','front','bottom'];const arr=localNormal.toArray();let axis=arr.map(Math.abs).indexOf(Math.max(...arr.map(Math.abs)));const face=arr[axis]>=0?axes[axis]:opposite[axis];let point=found.point.clone();
   if(this.pickMode==='measure'&&this.measureSnap==='vertex'&&found.face){const pos=found.object.geometry.attributes.position;const verts=[found.face.a,found.face.b,found.face.c].map(i=>new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(found.object.matrixWorld));verts.sort((a,b)=>a.distanceTo(point)-b.distanceTo(point));point=verts[0];}
   if(this.pickMode==='measure')this.events.point?.(point.toArray());else this.events.select?.(id,{face,point:found.point.toArray(),extend:e.shiftKey||e.ctrlKey||e.metaKey});});
  this.renderer.domElement.addEventListener('dblclick',e=>{if(this.placing||this.pickMode==='measure'||this.transform.axis)return;const rect=host.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects([...this.objects.values()].filter(o=>o.visible),true).find(h=>h.object.isMesh&&h.object.userData.partId);if(hit)this.events.editSurface?.(hit.object.userData.partId,hit.object.userData.featureId);});
  this.resize();
 }
 setProject(project){this.project=project;this.motionOverrides={};this.rebuild();}
 placementRay(x,y){const rect=this.renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return null;this.pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);this.camera.updateMatrixWorld();this.ray.setFromCamera(this.pointer,this.camera);return this.ray;}
 hitSurface(x,y,excludeId=null){
  if(this.explode||!this.placementRay(x,y))return null;this.content.updateMatrixWorld(true);
  const bodies=[...(this.project.enclosure.enabled?panels(this.project.enclosure):[]),...this.project.parts.filter(p=>p.id!==excludeId&&p.kind!=='space')],roots=bodies.map(p=>this.objects.get(p.id)).filter(o=>o?.visible);
  const hits=this.ray.intersectObjects(roots,true);
  for(const hit of hits){const p=bodies.find(p=>p.id===hit.object.userData.partId);if(!p)continue;const result=surfaceHit(hit,this.objects.get(p.id),p);if(result)return result;}
  return null;
 }
 pointOnSurface(x,y,frame){if(!this.placementRay(x,y))return null;const origin=new T.Vector3().setFromMatrixPosition(frame.world),normal=new T.Vector3(0,0,1).transformDirection(frame.world),point=this.ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(normal,origin),new T.Vector3());return point?.toArray()||null;}
 beginPlacement(){cancelTransform(this);this.clearPlacement();this.placementTool=this.tool;this.placing=true;this.setTool('orbit');this.placementInputs={mouse:{...this.orbit.mouseButtons},touch:{...this.orbit.touches}};this.orbit.mouseButtons.LEFT=null;this.orbit.touches.ONE=null;if(this.selection)this.selection.visible=false;}
 previewPlacement(part,frame,pose,{existing=false,u=0,v=0,gap=0}={}){
  if(!this.placementGhost){this.placementGhost=partObject({...part,visible:true});decorateObject(this.placementGhost,part,(this.project.features||[]).filter(f=>f.type!=='decal'));this.placementGhost.traverse(o=>{o.castShadow=false;if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=true;m.opacity=.55;m.depthWrite=false;}});this.scene.add(this.placementGhost);}
  const ghost=this.placementGhost;ghost.visible=true;ghost.position.fromArray(pose.pos);ghost.rotation.set(...pose.rot.map(n=>n*Math.PI/180));
  if(existing&&this.objects.get(part.id)){this.placementOriginal={id:part.id,visible:part.visible};this.objects.get(part.id).visible=false;}
  const color=pose.overhang?'#d58938':'#27a488',key=frame.panel+'|'+frame.face;
  if(this.placementGuide?.userData.key!==key){
   if(this.placementGuide){this.scene.remove(this.placementGuide);dispose(this.placementGuide);}
   const guide=new T.Group();guide.userData.key=key;
   const plane=new T.Mesh(new T.PlaneGeometry(...frame.span),new T.MeshBasicMaterial({color,transparent:true,opacity:.13,depthWrite:false,depthTest:false,side:T.DoubleSide}));plane.position.z=.04;guide.add(plane);
   const lines=new T.LineSegments(new T.BufferGeometry().setFromPoints(Array.from({length:8},()=>new T.Vector3())),new T.LineBasicMaterial({color,transparent:true,opacity:.8,depthTest:false}));guide.add(lines);
   for(const [text,pos] of [['+U',[frame.span[0]/2,0,1]],['+V',[0,frame.span[1]/2,1]]]){const label=labelSprite(text);label.position.fromArray(pos);label.scale.multiplyScalar(.6);guide.add(label);}
   guide.applyMatrix4(frame.world);this.scene.add(guide);this.placementGuide=guide;
  }
  const guide=this.placementGuide;guide.visible=true;guide.children[0].material.color.set(color);guide.children[1].material.color.set(color);
  const points=[[-frame.span[0]/2,0,.1],[frame.span[0]/2,0,.1],[0,-frame.span[1]/2,.1],[0,frame.span[1]/2,.1],[0,v,.15],[u,v,.15],[u,0,.15],[u,v,.15]],geometry=guide.children[1].geometry;
  points.forEach((p,i)=>geometry.attributes.position.setXYZ(i,...p));geometry.attributes.position.needsUpdate=true;geometry.computeBoundingSphere();this.render();
 }
 hidePlacement(){if(this.placementGhost)this.placementGhost.visible=false;if(this.placementGuide)this.placementGuide.visible=false;this.render();}
 clearPlacement(){for(const key of ['placementGhost','placementGuide'])if(this[key]){this.scene.remove(this[key]);dispose(this[key]);this[key]=null;}if(this.placementOriginal){const o=this.objects.get(this.placementOriginal.id);if(o)o.visible=this.placementOriginal.visible;this.placementOriginal=null;}this.placing=false;this.orbit.enabled=true;if(this.placementInputs){Object.assign(this.orbit.mouseButtons,this.placementInputs.mouse);Object.assign(this.orbit.touches,this.placementInputs.touch);this.placementInputs=null;}if(this.selection)this.selection.visible=true;if(this.placementTool){const tool=this.placementTool;this.placementTool=null;this.setTool(tool);}this.render();}
 rebuild(){
  if(!this.project)return;cancelTransform(this);this.transform.detach();if(this.selection){this.scene.remove(this.selection);dispose(this.selection);this.selection=null;}
  this.scene.remove(this.content);dispose(this.content);this.content=new T.Group();this.scene.add(this.content);this.objects.clear();
  const display=evaluatePose(this.project,this.motionOverrides||{});this.posedProject=display;const e=this.project.enclosure;this.geometryErrors=[];try{this.shell=enclosureObject(e,this.shellMode,this.explode,this.wood,this.project.features,()=>this.render());}catch(err){this.geometryErrors.push(err.message);this.shell=enclosureObject(e,this.shellMode,this.explode,this.wood);}this.content.add(this.shell);for(const obj of this.shell.children){this.objects.set(obj.userData.partId,obj);const pose=display.panelPoses.find(a=>a.id===obj.userData.partId),original=panels(e).find(a=>a.id===obj.userData.partId);if(pose)applyPanelPose(obj,pose,e,this.shellMode,this.explode,!!driven(this.project,pose.id));}
  for(const p of display.parts){const o=partObject(p);try{decorateObject(o,p,this.project.features||[],()=>this.render());}catch(err){this.geometryErrors.push(p.name+': '+err.message);}if(this.explode){const k=this.explode*.8;o.position.x+=p.pos[0]*k;o.position.y+=p.pos[1]*k;o.position.z+=Math.max(0,p.pos[2])*this.explode*1.8+this.explode*e.h*.2;}this.content.add(o);this.objects.set(p.id,o);if(this.labels&&p.visible){const label=labelSprite(p.name);label.position.set(0,0,p.dims[2]/2+9);o.add(label);}}
  if(this.explode===0)for(const w of this.project.wires||[])try{this.content.add(wireObject(display,w));}catch(err){this.geometryErrors.push(w.name+': '+err.message);}
  this.events.geometry?.(this.geometryErrors);this.applySection?.();
  if(!this.explode)this.applyPose(this.motionOverrides||{});this.axis.position.set(-e.w/2-15,-e.d/2-15,.1);this.select(this.selected);this.render();
 }
 setViewMode(mode){this.shellMode=mode;this.rebuild();}
 setExplode(value){this.explode=value;if(value>0)this.setTool('orbit');this.rebuild();}
 setTool(tool){cancelTransform(this);this.pickMode=tool==='measure'?'measure':'select';this.tool=tool;if(['translate','rotate'].includes(tool))this.lastTransformMode=tool;this.transform.detach();if(['translate','rotate'].includes(tool)&&this.explode===0&&!this.placing){const p=this.project?.parts.find(a=>a.id===this.selected),object=this.objects.get(this.selected);if(p&&object&&!p.locked&&p.visible&&!driven(this.project,p.id)){this.transform.setMode(tool);this.transform.attach(object);}}this.events.tool?.(tool,!!this.transform.object);this.render();}
 setTransformSettings(settings){configureTransform(this,settings);}
 setSnap(translation,rotation){configureTransform(this,{...this.transformSettings,step:translation,angle:rotation});}
 cancelTransform(){return cancelTransform(this);}
 select(id,{auto=id!==this.selected}={}){cancelTransform(this);this.selected=id;this.transform.detach();if(this.selection){this.scene.remove(this.selection);dispose(this.selection);this.selection=null;}const objects=this.project?.groups?.some(g=>g.id===id)?groupParts(this.project,id).map(p=>this.objects.get(p.id)).filter(Boolean):[this.objects.get(id)].filter(Boolean);if(objects.length){const box=new T.Box3();for(const o of objects)if(o.visible)box.union(new T.Box3().setFromObject(o));if(!box.isEmpty()){this.selection=new T.Box3Helper(box,'#dd823e');this.selection.material.depthTest=false;this.selection.renderOrder=99;this.scene.add(this.selection);}}const editable=this.project?.parts.find(p=>p.id===id&&p.visible&&!p.locked&&!driven(this.project,p.id));this.setTool(auto&&editable&&this.explode===0&&!this.placing&&this.pickMode!=='measure'?(this.lastTransformMode||'translate'):this.tool);this.render();}
 updateSelection(){if(!this.selection)return;const ids=this.project?.groups.some(g=>g.id===this.selected)?groupParts(this.project,this.selected).map(p=>p.id):[this.selected];const box=new T.Box3();for(const id of ids){const o=this.objects.get(id);if(o?.visible)box.union(new T.Box3().setFromObject(o));}if(!box.isEmpty())this.selection.box.copy(box);}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);const a=w/h;this.camera.left=-this.size*a/2;this.camera.right=this.size*a/2;this.camera.top=this.size/2;this.camera.bottom=-this.size/2;this.camera.updateProjectionMatrix();this.render();}
 render(){this.renderer?.render(this.scene,this.camera);}
 fit(view){if(!this.project)return;const box=new T.Box3().setFromObject(this.content);if(box.isEmpty())box.set(new T.Vector3(-150,-100,0),new T.Vector3(150,100,110));const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());const aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight);this.size=Math.max(size.length()*1.25,120)/Math.min(1,aspect);const dirs={iso:[1.2,-1.55,1.2],front:[0,-1,0],back:[0,1,0],left:[-1,0,0],right:[1,0,0],top:[0,-.000001,1],bottom:[0,-.000001,-1]};let dir=view?new T.Vector3(...dirs[view]):this.camera.position.clone().sub(this.orbit.target);if(dir.length()===0)dir.set(1,-1,1);dir.normalize();this.camera.position.copy(center).addScaledVector(dir,3000);this.camera.zoom=1;this.orbit.target.copy(center);this.camera.lookAt(center);this.orbit.update();this.resize();}
 setGrid(value){this.gridEnabled=value;this.grid.visible=value;this.axis.visible=value;this.render();}
 setTheme(theme){const bg=theme==='dark'?'#243c32':theme==='contrast'?'#111111':'#e7ebe4';this.scene.background.set(bg);this.grid.material.opacity=theme==='light'?.5:.22;this.render();}
 snapshot(){const measurement=this.measurement?.visible;if(this.measurement)this.measurement.visible=false;const selection=this.selection?.visible;const gizmo=this.transform.getHelper().visible,grid=this.grid.visible,axis=this.axis.visible;if(this.selection)this.selection.visible=false;this.transform.getHelper().visible=false;this.grid.visible=false;this.axis.visible=false;this.render();const url=this.renderer.domElement.toDataURL('image/png');if(this.measurement)this.measurement.visible=measurement;if(this.selection)this.selection.visible=selection;this.transform.getHelper().visible=gizmo;this.grid.visible=grid;this.axis.visible=axis;this.render();return url;}
 buildExport({partId=null,current=false,includeDecals=false}={}){if(this.geometryErrors.length)throw Error('Resolve geometry errors before exporting: '+this.geometryErrors.join('; '));const p=evaluatePose(this.project,current?this.motionOverrides||{}:{}),g=new T.Group();if(!partId||partId.startsWith('@')){const shell=enclosureObject(partId?.startsWith('@')?{...p.enclosure,enabled:true}:p.enclosure,current?this.shellMode:'closed',current?this.explode:0,this.wood,p.features||[]);for(const o of [...shell.children]){if(partId&&o.userData.partId!==partId){shell.remove(o);continue;}const a=p.panelPoses.find(a=>a.id===o.userData.partId);if(a)applyPanelPose(o,a,p.enclosure,current?this.shellMode:'closed',current?this.explode:0,!!driven(this.project,a.id));}g.add(shell);}for(const a of p.parts)if(a.kind!=='space'&&(!partId||a.id===partId)&&(!current||a.visible)){const o=partObject({...a,visible:true});decorateObject(o,a,p.features||[]);if(current&&this.objects.has(a.id)){o.position.copy(this.objects.get(a.id).position);o.rotation.copy(this.objects.get(a.id).rotation);}g.add(o);}if(current&&this.explode===0)for(const w of p.wires||[])g.add(wireObject(p,w));g.traverse(o=>{for(const child of [...o.children])if(child.isLineSegments||child.isSprite||(!includeDecals&&child.userData.decal))o.remove(child);});g.updateMatrixWorld(true);return g;}
 applyPose(overrides={}){if(!this.project||this.explode)return;const p=evaluatePose(this.project,overrides);this.motionOverrides=overrides;this.posedProject=p;this.transform?.detach();for(const a of [...p.parts,...p.panelPoses]){const o=this.objects.get(a.id);if(o){if(a.id.startsWith('@'))applyPanelPose(o,a,p.enclosure,this.shellMode,0,!!driven(this.project,a.id));else{o.position.fromArray(a.pos);o.rotation.set(...a.rot.map(n=>n*Math.PI/180));}}}for(const o of [...this.content.children])if(o.userData.cable){this.content.remove(o);dispose(o);}for(const w of p.wires)this.content.add(wireObject(p,w));this.updateSelection();this.applySection();this.render();}

 exportSTL(partId=null){const g=this.buildExport({partId});const result=new STLExporter().parse(g,{binary:true});dispose(g);return result;}
 async exportGLB(){const g=this.buildExport({current:true,includeDecals:true});await texturesReady(this.project.features);g.scale.setScalar(.001);g.rotation.x=-Math.PI/2;g.updateMatrixWorld(true);try{return await new GLTFExporter().parseAsync(g,{binary:true,onlyVisible:true});}finally{dispose(g);}}
 cameraState(){return {position:this.camera.position.toArray(),target:this.orbit.target.toArray(),zoom:this.camera.zoom,size:this.size,shell:this.shellMode,explode:this.explode};}
 restoreCamera(c){this.shellMode=c.shell;this.explode=c.explode;this.camera.position.fromArray(c.position);this.orbit.target.fromArray(c.target);this.camera.zoom=c.zoom;this.size=c.size;this.rebuild();this.orbit.update();this.resize();}
 setSection(axis,value){this.section=axis==='none'?null:{axis,value};this.applySection();this.render();}
 applySection(){const s=this.section,plane=s?new T.Plane(new T.Vector3(...({x:[-1,0,0],y:[0,-1,0],z:[0,0,-1]}[s.axis])),s.value):null;this.content.traverse(o=>{for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat){mat.clippingPlanes=plane?[plane]:[];mat.clipShadows=true;}});}
 showMeasurement(points){if(this.measurement){this.scene.remove(this.measurement);dispose(this.measurement);}const group=new T.Group(),pts=points.map(p=>new T.Vector3(...p));if(pts.length>1)group.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#f08131',depthTest:false})));for(const point of pts){const dot=new T.Mesh(new T.SphereGeometry(1.4,12,8),new T.MeshBasicMaterial({color:'#fa943d',depthTest:false}));dot.position.copy(point);dot.renderOrder=101;group.add(dot);}this.measurement=group;this.scene.add(group);this.render();}

}
export function parseSTL(buffer,units='mm'){
 const geometry=new STLLoader().parse(buffer),position=geometry.getAttribute('position');if(!position||position.count<3||position.count%3)throw Error('No complete STL triangles were found.');if(position.count>1500000)throw Error('This STL exceeds 500,000 triangles. Simplify it before importing.');
 const positions=position.array;if(!Array.from(positions).every(Number.isFinite))throw Error('STL contains non-finite coordinates.');geometry.computeBoundingBox();const size=geometry.boundingBox.getSize(new T.Vector3()),center=geometry.boundingBox.getCenter(new T.Vector3());if(Math.min(size.x,size.y,size.z)<=.000001)throw Error('STL must have a nonzero size on all three axes.');const factor=units==='in'?25.4:1,dims=size.toArray().map(a=>a*factor);if(Math.max(...dims)>5000||Math.min(...dims)<.01)throw Error('Model size is outside 0.01–5000 mm. Check import units.');
 const vertices=[];for(let i=0;i<positions.length;i+=3){vertices.push((positions[i]-center.x)/size.x,(positions[i+1]-center.y)/size.y,(positions[i+2]-center.z)/size.z);}geometry.dispose();return {kind:'mesh',dims,vertices};
}
