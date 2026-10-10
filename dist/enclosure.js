import * as T from 'three';

export const ENCLOSURE_STYLES={plain:'Lift-off lid',internal:'Internal screw posts',external:'External screw tabs',slide:'Sliding lid',hinge:'Pin-hinged lid',snap:'Snap-fit lid'};
export const CLOSURE_FIELDS={clearance:'Fit clearance',fastener:'Screw hole diameter',boss:'Post diameter',engagement:'Pilot-hole depth',ear:'External tab width',groove:'Groove depth',pin:'Hinge pin diameter',hingeLength:'Hinge length',snapLength:'Clip length',snapThickness:'Clip thickness',snapWidth:'Clip width'};
export const CLOSURE_KEYS={plain:[],internal:['clearance','fastener','boss','engagement'],external:['clearance','fastener','ear'],slide:['clearance','groove'],hinge:['clearance','pin','hingeLength'],snap:['clearance','snapLength','snapThickness','snapWidth']};
export const CLOSURE_NOTES={plain:'A separate lid lifts away from the six-panel body.',internal:'Four internal posts, pilot bores, lid clearance holes and shallow head recesses. Loose screws and threads are not modeled.',external:'Matching tabs project outside the side walls and lid, with four screw clearance holes. Loose fasteners are not modeled.',slide:'The lid slides out toward the front through side-wall grooves. The front wall is lowered to clear the lid.',hinge:'Alternating knuckles, connecting leaves and a removable pin along the back edge. Open view swings the lid around the pin.',snap:'Four cantilever clips with ramped catches engage side-wall windows. The geometry represents the fit; elastic behavior is not simulated.'};
export function closureDefaults(e={w:300,d:220,h:110,t:6}){const inside=Math.max(.1,Math.min(e.w,e.d)-2*e.t),room=Math.max(.1,e.h-2*e.t);return {type:'plain',clearance:.25,fastener:3.2,boss:Math.min(10,inside/4),engagement:Math.min(10,room/2),ear:12,groove:Math.min(2,e.t*.45),pin:3,hingeLength:Math.min(80,e.w*.65),snapLength:Math.min(14,room*.5),snapThickness:Math.min(1.5,e.t*.4),snapWidth:Math.min(8,inside/5)};}
export function normalizeClosure(raw,e){const c={...closureDefaults(e),...raw};if(!Object.hasOwn(ENCLOSURE_STYLES,c.type))throw Error('Choose a supported enclosure closure style.');
 for(const k of Object.keys(CLOSURE_FIELDS)){const min=k==='clearance'?0:.01;if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<min||c[k]>1000)throw Error(CLOSURE_FIELDS[k]+' must be '+min+'–1000 mm.');}
 const inside=Math.min(e.w,e.d)-2*e.t,room=e.h-2*e.t;
 if(c.type==='internal'&&(c.boss<c.fastener+2*c.clearance+1||2*c.boss+2*c.clearance>=inside||c.engagement>=room))throw Error('Screw posts need at least 1 mm around the clearance bore, room between opposite posts, and pilot depth below the lid less than the inside height.');
 if(c.type==='external'&&(c.ear<c.fastener+2*c.clearance+2||c.ear*3+2*e.t>=e.d||room<=e.t))throw Error('External tabs need 2 mm around the screw clearance holes and space for two tabs along each side.');
 if(c.type==='slide'&&(c.groove>=e.t*.8||c.groove<=c.clearance||e.h<=4*e.t+2*c.clearance||inside<=2*c.clearance))throw Error('Sliding lids need groove depth greater than clearance and below 80% of wall thickness, plus enclosure height above four wall thicknesses.');
 if(c.type==='hinge'&&(c.hingeLength>=e.w-2*e.t||c.hingeLength<=5*c.pin+8*c.clearance||c.pin+2*c.clearance>room))throw Error('The hinge must fit between the side walls, with length above five pin diameters plus the knuckle gaps.');
 if(c.type==='snap'&&(c.snapLength>=room-c.clearance||c.snapLength<=2*c.snapThickness||c.snapWidth*3>=e.d-2*e.t||2*(c.snapThickness+c.clearance)>=inside||c.clearance>=e.t*.5))throw Error('Snap clips need room inside the enclosure, length above twice their thickness, and clearance below half the wall thickness.');
 return c;
}
// Generated closure details are attached to their panel, in panel-local coordinates.
// Stable panel IDs preserve user-applied artwork and machining when styles change.
export function applyClosure(e,panels){const c=normalizeClosure(e.closure,e);if(c.type==='plain')return panels;const {w,d,h,t}=e,byId=new Map(panels.map(p=>[p.id,p]));
 const edit=(id,values)=>Object.assign(byId.get('@'+id),values);
 if(c.type==='slide'){
  for(const id of ['Left','Right'])edit(id,{dims:[t,d,h-t],pos:[id==='Left'?-w/2+t/2:w/2-t/2,0,(h+t)/2]});
  edit('Back',{dims:[w-2*t,t,h-t],pos:[0,d/2-t/2,(h+t)/2]});
  edit('Front',{dims:[w-2*t,t,h-3*t-c.clearance],pos:[0,-d/2+t/2,(h-t-c.clearance)/2]});
  edit('Lid',{dims:[w-2*t+2*c.groove-2*c.clearance,d-t-c.clearance,t],pos:[0,(-t-c.clearance)/2,h-1.5*t]});
 }
 for(const p of panels){p.closureType=c.type;p.closureOps=[];}
 function op(id,name,operation,shape,size,pos,rot=[0,0,0]){const p=byId.get('@'+id);p.closureOps.push({name,operation,shape,size,pos:pos.map((n,i)=>n-p.pos[i]),rot});}
 const box=(id,name,operation,size,pos)=>op(id,name,operation,'box',size,pos);
 const cyl=(id,name,operation,diameter,length,pos,rot)=>op(id,name,operation,'cylinder',[diameter,diameter,length],pos,rot);
 if(c.type==='internal')for(const sx of [-1,1])for(const sy of [-1,1]){const x=sx*(w/2-t-c.boss/2),y=sy*(d/2-t-c.boss/2),hole=c.fastener+2*c.clearance;
  cyl('Base','Screw post','add',c.boss,h-2*t+.02,[x,y,h/2-.01]);cyl('Base','Pilot bore','subtract',c.fastener,c.engagement+.04,[x,y,h-t-c.engagement/2]);
  cyl('Lid','Screw clearance','subtract',hole,t+.1,[x,y,h-t/2]);const depth=Math.min(2,t*.45);cyl('Lid','Head recess','subtract',Math.max(hole,c.fastener*1.8),depth+.04,[x,y,h-depth/2]);
 }
 if(c.type==='external')for(const sx of [-1,1])for(const sy of [-1,1]){const x=sx*(w/2+c.ear/2-t*.15),y=sy*(d/2-t-c.ear),wall=sx<0?'Left':'Right';
  box(wall,'Body screw tab','add',[c.ear,c.ear,t],[x,y,h-1.5*t]);box('Lid','Lid screw tab','add',[c.ear,c.ear,t],[x,y,h-t/2]);
  cyl(wall,'Tab clearance','subtract',c.fastener+2*c.clearance,t+.1,[x,y,h-1.5*t]);cyl('Lid','Tab clearance','subtract',c.fastener+2*c.clearance,t+.1,[x,y,h-t/2]);
 }
 if(c.type==='slide')for(const sx of [-1,1])box(sx<0?'Left':'Right','Lid slide groove','subtract',[c.groove+.04,d+.1,t+2*c.clearance],[sx*(w/2-t+c.groove/2),0,h-1.5*t]);
 if(c.type==='hinge'){const radius=(c.pin+2*c.clearance)/2+t*.6,length=(c.hingeLength-4*c.clearance)/5,axisY=d/2+radius,axisZ=h-t;
  for(let i=0;i<5;i++){const id=i%2?'Lid':'Back',x=-c.hingeLength/2+length/2+i*(length+c.clearance);
   box(id,'Hinge leaf','add',[length,radius+t*.4,t*.6],[x,d/2+(radius-t*.4)/2,axisZ+(id==='Lid'?t*.3:-t*.3)]);
   cyl(id,'Hinge knuckle','add',radius*2,length,[x,axisY,axisZ],[0,90,0]);cyl(id,'Pin bore','subtract',c.pin+2*c.clearance,length+.1,[x,axisY,axisZ],[0,90,0]);
  }
  cyl('Lid','Hinge pin','add',c.pin,c.hingeLength+2*c.pin,[0,axisY,axisZ],[0,90,0]);
 }
 if(c.type==='snap')for(const sx of [-1,1])for(const sy of [-1,1]){const inner=sx*(w/2-t),y=sy*d*.25,L=c.snapLength,b=c.snapThickness,W=c.snapWidth,catchH=Math.min(t*.55,L*.25),toothW=b+c.clearance+t*.55,catchZ=h-t-L+catchH/2;
  box('Lid','Snap cantilever','add',[b,W,L+.04],[inner-sx*(c.clearance+b/2),y,h-t-L/2]);
  op('Lid','Snap catch ramp','add','ramp',[toothW,catchH,W],[inner+sx*(t*.55-c.clearance-b)/2,y,catchZ],[90,0,sx<0?180:0]);
  box(sx<0?'Left':'Right','Snap catch window','subtract',[t+.1,W+2*c.clearance,catchH+2*c.clearance],[sx*(w/2-t/2),y,catchZ]);
 }
 return panels;
}
export function closureOpenMatrix(e){const c=normalizeClosure(e.closure,e);if(c.type==='hinge'){const radius=(c.pin+2*c.clearance)/2+e.t*.6,y=e.d/2+radius,z=e.h-e.t;return new T.Matrix4().makeTranslation(0,y,z).multiply(new T.Matrix4().makeRotationX(-110*Math.PI/180)).multiply(new T.Matrix4().makeTranslation(0,-y,-z));}if(c.type==='slide')return new T.Matrix4().makeTranslation(0,-e.d*.8,0);return null;}
