import {parseLength} from './dimensions.js';
import {driven} from './motion.js';
import {FACE_NAMES,surfaces,surfaceFrame,surfacePosition,placeOnSurface,snapSurface} from './placement.js';

// A placement is a draft. Only a valid drop / Place commits it to project history.
export function initPlacement(api){
 const $=s=>document.querySelector(s),host=$('#viewport'),catalog=$('#catalog'),inspector=$('#inspectorContent'),esc=api.esc;
 const dock=document.createElement('section');dock.id='placementDock';dock.className='placement-dock';dock.hidden=true;dock.setAttribute('aria-label','Surface placement');host.before(dock);
 let state=null,pointerStart=null,dragEnded=0,step=1,origin=null,multiTouch=false;const pointers=new Set();
 const P=api.project,S=api.studio,units=()=>P().units,display=n=>+(n/(units()==='in'?25.4:1)).toFixed(4);
 const guard=fn=>{try{return fn();}catch(e){api.notify(e.message);return false;}};
 const fields=(values,prefix)=>`<div class="fields placement-fields">${[['u','Across U'],['v','Along V'],['gap','Gap'],['angle','Turn °']].map(([key,label])=>`<label>${label}${key==='angle'?'':` (${units()})`}<input data-${prefix}="${key}" value="${key==='angle'?+values[key].toFixed(3):display(values[key])}" inputmode="decimal" aria-label="${label}${key==='angle'?'':' in '+units()}"></label>`).join('')}</div>`;
 function eligible(part){if(part.locked)throw Error('Unlock this part before positioning it.');if(driven(P(),part.id))throw Error('Use Joints & motion to position this part.');if(!part.visible)throw Error('Show this part before positioning it.');}
 function cancel({focus=false}={}){if(!state)return;state=null;pointerStart=null;pointers.clear();multiTouch=false;dock.hidden=true;document.body.classList.remove('placing');S()?.clearPlacement();if(focus){if(origin?.isConnected)origin.focus();else host.focus();}}
 function drawDock(){
  dock.innerHTML=`<div class="placement-head"><div><span class="eyebrow">${state.existing?'REPOSITION':'PLACE COMPONENT'}</span><strong>${esc(state.part.name)}</strong></div><button data-place-action="cancel" aria-label="Cancel placement" title="Cancel (Escape)">×</button></div><div class="placement-actions"><label class="placement-surface">${state.slide?'Slide on this surface':'Mounting surface'}<select id="placementSurface"${state.slide?' disabled':''}><option value="">Point at a face or choose…</option>${surfaces(P(),state.part.id).map(r=>`<option value="${(r.panel.startsWith('@')?r.panel:encodeURIComponent(r.panel))}|${r.face}">${esc(r.label)}</option>`).join('')}</select></label><button data-place-action="rotate" title="Rotate 90 degrees (R)">↻ 90°</button><button data-place-action="finish" class="primary" disabled>${state.existing?'Apply':'Place part'}</button></div><details><summary>Exact placement & snapping</summary>${fields(state,'draft')}<div class="fields two"><label>Part face to attach<select id="placementMount">${Object.entries(FACE_NAMES).map(([k,v])=>`<option value="${k}"${k===state.mount?' selected':''}>${v}</option>`).join('')}</select></label><label>Grid snap<select id="placementSnap">${[0,.1,1,5].map(n=>`<option value="${n}"${step===n?' selected':''}>${n?display(n)+' '+units():'Free'}</option>`).join('')}</select></label></div></details><p id="placementStatus" role="status">Point at a component or enclosure face, then click. Or choose a surface and use Place part.</p><p class="placement-keys">Arrows: nudge · Shift: 10× · Alt: fine / unsnapped · R: turn · Esc: cancel</p>`;
 }
 function begin(part,{existing=false,dragging=false,slide=false}={}){return guard(()=>{
  cancel();if(!S())throw Error('Surface placement needs the 3D view. Enable WebGL and reload.');
  if(!surfaces(P(),part.id).length)throw Error('Show the enclosure or another component to choose a mounting surface.');
  if(existing)eligible(part);else if(P().parts.length>=500)throw Error('The project limit is 500 parts.');
  api.prepare();origin=document.activeElement;const prior=existing?surfacePosition(P(),part):null;
  state={part:structuredClone(part),existing,dragging,slide:slide&&!!prior,ref:null,frame:null,u:0,v:0,gap:0,angle:0,mount:'bottom',valid:false};
  S().beginPlacement();document.body.classList.add('placing');dock.hidden=false;drawDock();
  if(prior){Object.assign(state,prior);state.ref=part.surfaceRef;state.valid=true;update();}
  api.reveal(dragging);if(!dragging)$('#placementSurface').focus();return true;
 });}
 function update({snaps=[]}={}){
  if(!state?.frame)return;const pose=placeOnSurface(state.part,state.frame,state);state.pose=pose;state.valid=true;state.error='';for(const el of dock.querySelectorAll('[aria-invalid]'))el.removeAttribute('aria-invalid');
  S().previewPlacement(state.part,state.frame,pose,{...state});
  $('#placementSurface').value=(state.ref.panel.startsWith('@')?state.ref.panel:encodeURIComponent(state.ref.panel))+'|'+state.ref.face;$('#placementMount').value=state.mount;
  for(const el of dock.querySelectorAll('[data-draft]')){const key=el.dataset.draft;el.value=key==='angle'?+state[key].toFixed(3):display(state[key]);}
  $('[data-place-action=finish]').disabled=false;
  $('#placementStatus').textContent=`${state.frame.label} · U ${display(state.u)} · V ${display(state.v)} ${units()}${snaps.length?' · '+snaps.join(' / '):''}${pose.overhang?' · Extends beyond target face — check fit':''}`;
  dock.classList.toggle('placement-overhang',pose.overhang);
 }
 function move(e){if(!state)return false;return guard(()=>{
  let point;if(state.slide&&state.frame)point=S().pointOnSurface(e.clientX,e.clientY,state.frame);
  else{const hit=S().hitSurface(e.clientX,e.clientY,state.part.id);if(hit){state.ref={panel:hit.panel,face:hit.face};state.frame=surfaceFrame(P(),state.ref);point=hit.point;}}
  if(!point){state.valid=false;S().hidePlacement();$('[data-place-action=finish]').disabled=true;$('#placementStatus').textContent='No surface here. Point at a flat face or choose a surface above.';return false;}
  const snapped=snapSurface(state.part,state.frame,point,{...state,step,free:e.altKey});state.u=snapped.u;state.v=snapped.v;update(snapped);return true;
 });}
 function finish(){return guard(()=>{
  if(!state?.valid)throw Error('Choose a target face first.');if(state.error)throw Error(state.error);
  const draft=state;const original=draft.existing?P().parts.find(p=>p.id===draft.part.id):null;
  if(draft.existing){if(!original)throw Error('The part no longer exists.');eligible(original);}else if(P().parts.length>=500)throw Error('The project limit is 500 parts.');
  if(!surfaces(P(),draft.part.id).some(r=>r.panel===draft.ref.panel&&r.face===draft.ref.face))throw Error('That target is no longer available. Choose another face.');const {pos,rot,surfaceRef}=placeOnSurface(draft.part,surfaceFrame(P(),draft.ref),draft);cancel();
  api.commit(()=>{if(original)Object.assign(original,{pos,rot,surfaceRef});else P().parts.push({...draft.part,pos,rot,surfaceRef});});api.select(draft.part.id);host.focus();api.notify(`${draft.part.name} ${draft.existing?'positioned':'placed'} · ${draft.frame.label}`);return true;
 });}
 function read(key,value){if(key==='angle'){if(!String(value).trim()||!Number.isFinite(Number(value)))throw Error('Enter a rotation in degrees.');return Number(value);}return parseLength(value,units());}
 function editDraft(key,value){if(!state)return;const before=state[key];try{if(!state.frame)throw Error('Choose a mounting surface first.');state[key]=read(key,value);update();}catch(e){state[key]=before;state.error=e.message;dock.querySelector(`[data-draft="${key}"]`)?.setAttribute('aria-invalid','true');$('[data-place-action=finish]').disabled=true;$('#placementStatus').textContent=e.message;throw e;}}

 dock.addEventListener('click',e=>guard(()=>{const action=e.target.closest('[data-place-action]')?.dataset.placeAction;if(action==='cancel')cancel({focus:true});if(action==='finish')finish();if(action==='rotate'){state.angle=(state.angle+90)%360;update();}}));
 dock.addEventListener('change',e=>guard(()=>{
  if(!state)return;const el=e.target;
  if(el.id==='placementSurface'&&!el.value){state.ref=null;state.frame=null;state.valid=false;S().hidePlacement();$('[data-place-action=finish]').disabled=true;}
  if(el.id==='placementSurface'&&el.value){const [encoded,face]=el.value.split('|'),panel=decodeURIComponent(encoded);state.ref={panel,face};state.frame=surfaceFrame(P(),state.ref);state.u=0;state.v=0;update();}
  if(el.id==='placementSnap')step=Number(el.value);
  if(el.id==='placementMount'){state.mount=el.value;update();}
  if(el.dataset.draft)editDraft(el.dataset.draft,el.value);
 }));
 dock.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset.draft){e.preventDefault();guard(()=>editDraft(e.target.dataset.draft,e.target.value));}});
 catalog.addEventListener('dragstart',e=>{
  const card=e.target.closest('[data-add],[data-reuse]');if(!card)return;
  const part=api.fromCard(card);if(!part||!begin(part,{dragging:true})){e.preventDefault();return;}
  e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('application/x-mockupbench-part',part.id);e.dataTransfer.setData('text/plain',part.name);
 });
 catalog.addEventListener('dragend',()=>{dragEnded=Date.now();cancel();});
 host.addEventListener('dragover',e=>{if(!state?.dragging)return;e.preventDefault();e.dataTransfer.dropEffect=move(e)?'copy':'none';});
 host.addEventListener('dragleave',e=>{if(state?.dragging&&!host.contains(e.relatedTarget)){S().hidePlacement();state.valid=false;}});
 host.addEventListener('drop',e=>{if(!state?.dragging)return;e.preventDefault();e.stopPropagation();if(move(e))finish();else{cancel();api.notify('Drop onto a component or enclosure face to add this part.');}dragEnded=Date.now();});
 host.addEventListener('pointermove',e=>{if(state&&!state.dragging&&e.target===S()?.renderer.domElement&&!multiTouch&&(!e.buttons||e.pointerType==='touch'))move(e);});
 host.addEventListener('pointerdown',e=>{if(!state||e.target!==S()?.renderer.domElement)return;pointers.add(e.pointerId);if(pointers.size>1)multiTouch=true;pointerStart={x:e.clientX,y:e.clientY};});
 host.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(multiTouch){if(!pointers.size)multiTouch=false;pointerStart=null;return;}if(!state||state.dragging||e.button!==0||!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)return;if(move(e))finish();pointerStart=null;});
 host.addEventListener('pointercancel',()=>{pointerStart=null;pointers.clear();multiTouch=false;});
 document.addEventListener('keydown',e=>{
  if(!state)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel({focus:true});return;}
  if(['INPUT','TEXTAREA','SELECT','SUMMARY'].includes(e.target.tagName))return;if(e.target.tagName==='BUTTON'&&!e.key.startsWith('Arrow'))return;
  if(e.key==='Enter'){e.preventDefault();finish();return;}if(e.key.toLowerCase()==='r'){e.preventDefault();state.angle=(state.angle+90)%360;guard(()=>update());return;}
  if(state.frame&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const amount=(step||1)*(e.altKey?.1:e.shiftKey?10:1),key=['ArrowLeft','ArrowRight'].includes(e.key)?'u':'v';state[key]+=amount*(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1);guard(()=>update());}
 },true);
 function inspectorHTML(part){
  let current;try{current=surfacePosition(P(),part);}catch{}const blocked=part.locked||driven(P(),part.id)||!part.visible;
  return `<section class="inspector-section surface-position"><h3>Surface position</h3>${current?`<p class="surface-reference">${esc(current.frame.label)}</p><fieldset${blocked?' disabled':''}>${fields(current,'surface-value')}<div class="surface-nudges" role="group" aria-label="Nudge on mounting surface"><button data-surface-nudge="u|-1" aria-label="Nudge negative U">← U</button><button data-surface-nudge="u|1" aria-label="Nudge positive U">U →</button><button data-surface-nudge="v|-1" aria-label="Nudge negative V">↓ V</button><button data-surface-nudge="v|1" aria-label="Nudge positive V">V ↑</button></div><div class="mini-actions"><button data-surface-action="slide">Slide on surface</button><button data-surface-action="center">Center</button><button data-surface-action="flush">Flush</button></div></fieldset>`:''}<button data-surface-action="place" class="wide"${blocked?' disabled':''}>${current?'Snap to another face…':'Snap to a face…'}</button><p class="hint">${current?'U / V measure from the face center. Positive gap lifts off the panel; negative gap recesses. Nudge = '+display(step||1)+' '+units()+'. The reference does not move either part automatically.':'Choose a component or enclosure face, then set exact offsets and gap. The face picker uses nominal body envelopes.'}</p></section>`;
 }
 function editExisting(changes){const p=P().parts.find(p=>p.id===api.selected());if(!p)return;eligible(p);if(S()?.explode)throw Error('Return Explode to 0% before editing positions.');const current=surfacePosition(P(),p);if(!current)throw Error('Choose a surface for this part first.');const {pos,rot,surfaceRef}=placeOnSurface(p,current.frame,{...current,...changes});api.commit(()=>Object.assign(p,{pos,rot,surfaceRef}));}
 inspector.addEventListener('change',e=>{if(!e.target.dataset.surfaceValue)return;const key=e.target.dataset.surfaceValue;guard(()=>editExisting({[key]:read(key,e.target.value)}));});
 inspector.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset.surfaceValue){e.preventDefault();const key=e.target.dataset.surfaceValue;guard(()=>{editExisting({[key]:read(key,e.target.value)});const next=$(`[data-surface-value="${key}"]`);next?.focus();next?.select();});}});
 inspector.addEventListener('click',e=>guard(()=>{
  const action=e.target.closest('[data-surface-action]')?.dataset.surfaceAction,nudge=e.target.closest('[data-surface-nudge]')?.dataset.surfaceNudge;if(!action&&!nudge)return;
  const p=P().parts.find(p=>p.id===api.selected());if(!p)return;
  if(action==='place'||action==='slide')begin(p,{existing:true,slide:action==='slide'});
  if(action==='center')editExisting({u:0,v:0});if(action==='flush')editExisting({gap:0});
  if(nudge){const [key,sign]=nudge.split('|'),current=surfacePosition(P(),p);editExisting({[key]:current[key]+Number(sign)*(step||1)});}
 }));
 return {begin,cancel,inspectorHTML,active:()=>!!state,ignoreClick:()=>Date.now()-dragEnded<250};
}
