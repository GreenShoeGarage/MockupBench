import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {freshProject,makePart,validateProject} from '../dist/model.js';
import {initPlacement} from '../dist/placement-ui.js';
import {surfaceFrame,surfacePosition} from '../dist/placement.js';
import {createJoint} from '../dist/motion.js';
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
function setup(){
 const {document,window}=parseHTML(html);Object.assign(globalThis,{document,window});Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.options].find(o=>o.hasAttribute('selected'))?.value||this.options[0]?.value||'';},set(value){for(const o of this.options)o.value===String(value)?o.setAttribute('selected',''):o.removeAttribute('selected');}});
 const $=s=>document.querySelector(s),p=freshProject(),history=[],messages=[],previews=[],part=makePart('block',{dims:[30,20,10]});let selected=null,clear=0,prepares=0;
 const canvas=document.createElement('canvas');$('#viewport').prepend(canvas);$('#catalog').innerHTML='<button data-add="block" draggable="true">Block</button>';
 const stage={renderer:{domElement:canvas},beginPlacement(){},clearPlacement(){clear++;},hidePlacement(){},previewPlacement(a,f,pose){previews.push({a,f,pose});},hitSurface(x,y){return x<0?null:{panel:'@Base',face:'top',point:[x,y,p.enclosure.t]};},pointOnSurface(x,y,f){return [x,y,p.enclosure.t];}};
 const api={esc:s=>s,project:()=>p,studio:()=>stage,selected:()=>selected,notify:s=>messages.push(s),prepare:()=>prepares++,reveal(){},fromCard:()=>structuredClone(part),commit(fn){history.push(structuredClone(p));fn();validateProject(p);render();},select(id){selected=id;render();}};
 const controller=initPlacement(api);function render(){const current=p.parts.find(a=>a.id===selected);$('#inspectorContent').innerHTML=current?controller.inspectorHTML(current):'';}
 function fire(node,type,props={}){const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,props);node.dispatchEvent(e);return e;}
 function change(selector,value){const input=$(selector);input.value=value;fire(input,'change');}
 const transfer={effectAllowed:'',dropEffect:'',data:{},setData(k,v){this.data[k]=v;}};
 return {$,p,part,stage,history,messages,previews,controller,canvas,fire,change,transfer,api,get clear(){return clear;},get prepares(){return prepares;}};
}
test('native catalog drag/drop creates one undoable placed part; leaving or missing a surface adds nothing',()=>{
 const t=setup();t.fire(t.$('[data-add]'),'dragstart',{dataTransfer:t.transfer});assert.equal(t.controller.active(),true);assert.equal(t.transfer.effectAllowed,'copy');assert.equal(t.p.parts.length,0);
 t.fire(t.$('#viewport'),'dragover',{dataTransfer:t.transfer,clientX:22.4,clientY:13.6});assert.equal(t.transfer.dropEffect,'copy');assert.deepEqual(t.previews.at(-1).pose.pos,[22,14,11]);
 t.fire(t.$('#viewport'),'drop',{dataTransfer:t.transfer,clientX:22.4,clientY:13.6});assert.equal(t.p.parts.length,1);assert.equal(t.history.length,1);assert.deepEqual(t.p.parts[0].pos,[22,14,11]);assert.equal(t.controller.active(),false);
 t.fire(t.$('[data-add]'),'dragend');assert.equal(t.history.length,1);assert.equal(t.controller.ignoreClick(),true);
 t.fire(t.$('[data-add]'),'dragstart',{dataTransfer:t.transfer});t.fire(t.$('[data-add]'),'dragend');assert.equal(t.history.length,1);
 t.fire(t.$('[data-add]'),'dragstart',{dataTransfer:t.transfer});t.fire(t.$('#viewport'),'drop',{dataTransfer:t.transfer,clientX:-3,clientY:0});assert.equal(t.history.length,1);assert.equal(t.p.parts.length,1);
});
test('surface picker and exact fields place without dragging, including signed mixed-unit gap',()=>{
 const t=setup();assert.equal(t.controller.begin(t.part),true);assert.equal(t.$('[data-place-action=finish]').disabled,true);
 t.change('#placementSurface','@Front|front');t.change('[data-draft=u]','1 1/2 in');t.change('[data-draft=v]','-10 mm');t.change('[data-draft=gap]','-2 mm');t.change('#placementMount','back');t.change('[data-draft=angle]','30');t.$('[data-place-action=finish]').click();
 assert.equal(t.history.length,1);const pos=surfacePosition(t.p,t.p.parts[0]);assert.equal(pos.u,38.1);assert.equal(pos.v,-10);assert.equal(pos.gap,-2);assert.ok(Math.abs(pos.angle-30)<1e-4);assert.equal(pos.mount,'back');
 const before=JSON.stringify(t.p);t.$('[data-surface-action=slide]').click();t.fire(t.canvas,'pointermove',{buttons:0,clientX:50,clientY:60});t.$('[data-place-action=cancel]').click();assert.equal(JSON.stringify(t.p),before);assert.equal(t.history.length,1);
});
test('tap placement, plane slide, exact inspector offsets and nudge commit independently',()=>{
 const t=setup();t.controller.begin(t.part);for(const pointerId of [1,2])t.fire(t.canvas,'pointerdown',{button:0,pointerId,pointerType:'touch',clientX:17,clientY:23});for(const pointerId of [1,2])t.fire(t.canvas,'pointerup',{button:0,pointerId,pointerType:'touch',clientX:17,clientY:23});assert.equal(t.p.parts.length,0);t.fire(t.canvas,'pointerdown',{button:0,clientX:17,clientY:23});t.fire(t.canvas,'pointerup',{button:0,clientX:17,clientY:23});assert.equal(t.p.parts.length,1);
 t.$('[data-surface-action=slide]').click();assert.equal(t.$('#placementSurface').disabled,true);t.fire(t.canvas,'pointermove',{buttons:0,clientX:30,clientY:40});assert.deepEqual(t.p.parts[0].pos,[17,23,11]);t.$('[data-place-action=finish]').click();assert.deepEqual(t.p.parts[0].pos,[30,40,11]);assert.equal(t.history.length,2);
 t.change('[data-surface-value=u]','-1 in');assert.equal(t.p.parts[0].pos[0],-25.4);t.$('[data-surface-nudge="u|1"]').click();assert.equal(t.p.parts[0].pos[0],-24.4);t.change('[data-surface-value=gap]','3 mm');assert.equal(t.p.parts[0].pos[2],14);t.$('[data-surface-action=flush]').click();assert.equal(t.p.parts[0].pos[2],11);
 t.$('[data-surface-action=center]').click();assert.deepEqual(t.p.parts[0].pos,[0,0,11]);const saved=validateProject(JSON.parse(JSON.stringify(t.p)));assert.deepEqual(saved.parts[0].surfaceRef,{panel:'@Base',face:'top',mount:'bottom'});
});
test('keyboard nudge/turn/accept and cancel leave input editing and locked joint bodies protected',()=>{
 const t=setup();t.controller.begin(t.part);t.change('#placementSurface','@Base|top');t.fire(t.$('#viewport'),'keydown',{key:'ArrowRight',shiftKey:true});t.fire(t.$('#viewport'),'keydown',{key:'ArrowUp',altKey:true});t.fire(t.$('#viewport'),'keydown',{key:'r'});t.fire(t.$('#viewport'),'keydown',{key:'Enter'});assert.deepEqual(t.p.parts[0].pos,[10,.1,11]);assert.equal(t.p.parts[0].rot[2],90);
 const part=t.p.parts[0];part.locked=true;assert.equal(t.controller.begin(part,{existing:true}),false);part.locked=false;t.p.joints=[createJoint(t.p,{child:part.id,type:'slider'})];assert.equal(t.controller.begin(part,{existing:true}),false);t.p.joints=[];
 t.controller.begin(part,{existing:true});const before=JSON.stringify(t.p);t.fire(t.$('[data-draft=u]'),'keydown',{key:'ArrowRight'});assert.equal(JSON.stringify(t.p),before);t.fire(t.$('[data-draft=u]'),'keydown',{key:'Escape'});assert.equal(t.controller.active(),false);assert.equal(t.history.length,1);
});
test('invalid coordinates and unavailable enclosure fail without mutation or an enabled Place action',()=>{
 const t=setup();t.p.enclosure.enabled=false;assert.equal(t.controller.begin(t.part),false);assert.equal(t.controller.active(),false);t.p.enclosure.enabled=true;t.controller.begin(t.part);t.change('#placementSurface','@Base|top');t.change('[data-draft=gap]','garbage');assert.match(t.messages.at(-1),/dimension/);assert.equal(t.history.length,0);
 t.change('[data-draft=gap]','90000');assert.match(t.messages.at(-1),/range/);assert.equal(t.$('[data-place-action=finish]').disabled,true);t.$('[data-place-action=finish]').click();assert.equal(t.p.parts.length,0);t.change('[data-draft=gap]','0');t.$('[data-place-action=finish]').click();assert.equal(t.p.parts[0].pos[2],11);
});

test('existing parts snap to rotated component faces without an enclosure, then slide with exact offsets',()=>{
 const t=setup(),target=makePart('block',{id:'target|one',name:'Mounting plate',dims:[80,60,8],pos:[12,34,56],rot:[20,30,40]});t.p.enclosure.enabled=false;t.p.parts.push(target);assert.equal(t.controller.begin(t.part),true);const value=encodeURIComponent(target.id)+'|top';t.change('#placementSurface',value);t.change('[data-draft=u]','1/4 in');t.change('[data-draft=v]','-3 mm');t.change('[data-draft=gap]','2.5 mm');t.$('[data-place-action=finish]').click();const moving=t.p.parts[1],pos=surfacePosition(t.p,moving);assert.equal(pos.u,6.35);assert.equal(pos.v,-3);assert.equal(pos.gap,2.5);assert.equal(moving.surfaceRef.panel,target.id);assert.equal(t.history.length,1);
 t.$('[data-surface-action=slide]').click();assert.ok(![...t.$('#placementSurface').options].some(o=>o.value.startsWith(moving.id+'|')));t.change('[data-draft=u]','10 mm');assert.equal(surfacePosition(t.p,moving).u,6.35);t.$('[data-place-action=finish]').click();assert.equal(surfacePosition(t.p,moving).u,10);assert.equal(t.history.length,2);assert.deepEqual(validateProject(JSON.parse(JSON.stringify(t.p))).parts[1].surfaceRef,moving.surfaceRef);
});

test('part-face hit placement excludes itself and rejects a target that disappears before committing',()=>{
 const t=setup(),target=makePart('block',{id:'target',dims:[80,60,8],pos:[0,0,40]});t.p.enclosure.enabled=false;t.p.parts.push(target);let excluded;t.stage.hitSurface=(x,y,id)=>{excluded=id;return {panel:target.id,face:'top',point:[x,y,44]};};t.controller.begin(t.part);t.fire(t.canvas,'pointermove',{buttons:0,clientX:8,clientY:9});assert.equal(excluded,t.part.id);assert.deepEqual(t.previews.at(-1).pose.pos,[8,9,49]);target.visible=false;t.$('[data-place-action=finish]').click();assert.equal(t.history.length,0);assert.equal(t.p.parts.length,1);assert.match(t.messages.at(-1),/no longer available/);t.$('[data-place-action=cancel]').click();assert.equal(t.controller.active(),false);
});
