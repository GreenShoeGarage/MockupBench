import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import 'fake-indexeddb/auto';
import {freshProject,makePart,validateProject} from '../dist/model.js';
import {normalizeFeature} from '../dist/schema.js';
import {initEnclosureUI,enclosureInspector} from '../dist/enclosure-ui.js';
import {initGeometry} from '../dist/geometry.js';
import {initWorkspace} from '../dist/workspace.js';
import {saveCheckpoint,readRecord,saveRecord} from '../dist/storage.js';
await initGeometry({wasmBinary:await readFile(new URL('../dist/vendor/manifold.wasm',import.meta.url))});
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,10));
function setup(){const {document,window}=parseHTML(html);Object.assign(globalThis,{document,window});Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){v?this.setAttribute('checked',''):this.removeAttribute('checked');}});Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return [...this.options].find(o=>o.hasAttribute('selected'))?.value||this.options[0]?.value||'';},set(value){for(const o of this.options){if(o.value===String(value))o.setAttribute('selected','');else o.removeAttribute('selected');}}});let p=freshProject(),selected=null,notifications=[];const $=s=>document.querySelector(s);const modal=$('#modal');modal.showModal=()=>{modal.open=true;};modal.close=()=>{modal.open=false;modal.dispatchEvent(new window.Event('close'));};let ws;const studio={setProject(){},fit(){},setTool(){},showMeasurement(){},setSection(){},rebuild(){},cameraState(){return {position:[1,2,3],target:[0,0,0],zoom:1,size:500,shell:'open',explode:0};}};const api={esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),project:()=>p,studio:()=>studio,selected:()=>selected,notify:s=>notifications.push(s),openModal(title,body){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;modal.showModal();},download(){},commit(fn){const old=structuredClone(p);try{fn();validateProject(p);}catch(e){p=old;throw e;}},refresh(){if(ws){$('#assemblyList').innerHTML=ws.assemblyHTML();const content=ws.inspectorHTML(selected);$('#inspectorContent').innerHTML=content.replace||((content.prepend||'')+(content.append||''));}},select(id){selected=id;api.refresh();},replaceProject(q){p=q;},syncView(){},recoverSave:()=>saveCheckpoint(p)};ws=initWorkspace(api);return {$,window,api,ws,project:()=>p,notifications,select:api.select,async submit(){const form=$('#workspaceForm');await form.onsubmit({preventDefault(){},currentTarget:form});await tick();if($('#formError'))throw Error($('#formError').textContent);}};}
test('editor forms create a dimensioned part, cutout, lettering, mounting pattern and fabrication file',async()=>{
 const t=setup(),{$}=t;$('#customPart').click();$('[name=name]').value='Client panel';$('[name=w]').value='120';await t.submit();assert.equal(t.project().parts.length,1);assert.deepEqual(t.project().parts[0].dims,[120,80,6]);
 $('#surfaceFeature').click();$('[name=w]').value='20';$('[name=h]').value='10';await t.submit();assert.equal(t.project().features.length,1);assert.equal(t.project().features[0].host,t.project().parts[0].id);
 $('#surfaceFeature').click();$('[name=type]').value='emboss';$('[name=text]').value='CLIENT';await t.submit();assert.equal(t.project().features[1].type,'emboss');
 t.select(t.project().parts[0].id);$('[data-work=anchor]').click();$('[name=pos0]').value='20';await t.submit();assert.equal(t.project().parts[0].anchors.length,1);$('[data-work=mount-pattern]').click();await t.submit();assert.equal(t.project().features.at(-1).host,'@Base');
 $('#fabricationTools').click();await t.submit();assert.equal($('#modal').open,false);
});
test('editor grouping and saved-library controls create an insertable assembly',async()=>{
 const t=setup(),{$}=t;for(let i=0;i<2;i++){const a=makePart('block');a.pos[0]=i*60;t.project().parts.push(a);}t.api.refresh();$('#checkAllParts').click();$('#groupChecked').click();$('[name=name]').value='Reusable electronics';await t.submit();assert.equal(t.project().groups.length,1);assert.equal(t.project().parts[0].groupId,t.project().groups[0].id);
 $('[data-group-action=save]').click();await tick();await tick();assert.equal((await readRecord('library')).length,1);assert.ok($('[data-insert]'));$('[data-insert]').click();await tick();assert.equal(t.project().parts.length,4);assert.equal(t.project().groups.length,2);
});
test('supplier catalog workflow records data without requiring a live API',async()=>{
 const t=setup(),{$}=t;$('#supplierParts').click();$('[name=supplier]').value='Mouser';$('[name=supplierName]').value='Connector';$('[name=spn]').value='123-XYZ';$('[name=url]').value='https://www.mouser.com/example';$('#addSupplierPlaceholder').click();assert.equal(t.project().parts[0].supplier,'Mouser');assert.equal(t.project().parts[0].supplierNumber,'123-XYZ');
});
test('checkpoints are independent, bounded to five and do not overwrite current library',async()=>{
 await saveRecord('library',[{name:'Stored'}]);for(let i=0;i<7;i++){const p=freshProject();p.title='Revision '+i;await saveCheckpoint(p);}const result=await readRecord('recovery');assert.equal(result.length,5);assert.equal(result[0].project.title,'Revision 6');assert.equal(result[4].project.title,'Revision 2');assert.equal((await readRecord('library'))[0].name,'Stored');
});

test('applied cutouts, pockets, emboss, deboss and decals edit in place with drafts and cancellation',async()=>{
 const t=setup(),{$}=t,p=t.project(),image='data:image/png;base64,AAAA';
 p.features=[['cutout',true],['cutout',false],['emboss',false],['deboss',false],['decal',false]].map(([type,through],i)=>normalizeFeature({id:'f'+i,host:'@Lid',name:'Feature '+i,type,through,w:12,h:8,u:-80+i*40,v:0,depth:1,text:'A',fontSize:4,image:type==='decal'?image:''}));
 const ids=p.features.map(f=>f.id),previews=[];t.api.studio().setProject=q=>previews.push(structuredClone(q));
 t.select('@Lid');assert.ok(t.ws.inspectorHTML('@Lid').prepend.includes('Applied surface features'));
 for(let i=0;i<p.features.length;i++){
  t.api.refresh();$(`[data-feature="f${i}"]`).click();assert.ok($('#featureFacePreview svg'));assert.equal($('[type=submit]').textContent,'Save changes');
  const original=JSON.stringify(p);$('[name=name]').value='Edited '+i;$('[name=u]').value=String(-80+i*40+2);if(i<2){$('[name=w]').value='14';$('[name=through]').checked=i===1;$('[name=depth]').value='2';}else if(i<4){$('[name=text]').value='B';$('[name=font]').value='serif';$('[name=fontSize]').value='5';$('[name=depth]').value='1.5';}else{$('[name=opacity]').value='.6';$('[name=angle]').value='15';}
  $('#previewFeature').click();assert.equal(JSON.stringify(p),original);assert.equal(previews.at(-1).features[i].name,'Edited '+i);assert.deepEqual(previews.at(-1).features.map(f=>f.id),ids);await t.submit();assert.deepEqual(p.features.map(f=>f.id),ids);assert.equal(p.features[i].name,'Edited '+i);
 }
 assert.equal(p.features[0].through,false);assert.equal(p.features[1].through,true);assert.equal(p.features[2].text,'B');assert.equal(p.features[3].fontSize,5);assert.equal(p.features[4].image,image);assert.equal(p.features[4].opacity,.6);
 t.ws.editSurface('@Lid','f0');const saved=JSON.stringify(p);$('[name=name]').value='Cancelled';$('#previewFeature').click();$('[data-close]').click();assert.equal(JSON.stringify(p),saved);assert.equal(previews.at(-1).features[0].name,'Edited 0');assert.equal($('#modal').open,false);
 assert.deepEqual(validateProject(JSON.parse(saved)).features,p.features);
});

test('surface manager searches hosts and hidden features, and invalid polygon edits cannot replace saved geometry',async()=>{
 const t=setup(),{$}=t,p=t.project();p.features=[normalizeFeature({id:'a',host:'@Lid',name:'Logo',type:'decal',image:'data:image/png;base64,AAAA',visible:false}),normalizeFeature({id:'b',host:'@Front',name:'Socket',shape:'polygon',points:[[0,0],[1,0],[0,1]],w:5,h:5})];
 $('#editSurfaceFeatures').click();assert.equal($('#featureList').children.length,2);assert.match($('#featureList').textContent,/Hidden/);$('#featureSearch').value='logo';$('#featureSearch').dispatchEvent(new t.window.Event('input'));assert.equal($('#featureList').children.length,1);$('#featureList [data-feature-hide]').click();await tick();assert.equal(p.features[0].visible,true);assert.equal($('#featureList [data-feature-hide]').textContent,'Hide');
 $('#featureSearch').value='';$('#featureSearch').dispatchEvent(new t.window.Event('input'));$('[name=featureHost]').value='@Front';$('[name=featureHost]').dispatchEvent(new t.window.Event('change'));assert.equal($('#featureList').children.length,1);$('#featureList [data-feature]').click();assert.match($('#modalTitle').textContent,/Socket/);
 const before=JSON.stringify(p);$('#profilePoints').value='bad input';await assert.rejects(t.submit(),/two numbers/);assert.equal(JSON.stringify(p),before);assert.equal($('#modal').open,true);assert.equal($('#formError').getAttribute('role'),'alert');$('[data-close]').click();
});

test('closure style and dimension controls validate units, cancel drafts and retain applied surface features',()=>{
 const t=setup(),{$}=t,p=t.project();p.features=[normalizeFeature({id:'label',host:'@Lid',type:'deboss',text:'EDIT'})];const original=JSON.stringify(p.features);initEnclosureUI(t.api);
 function render(){$('#inspectorContent').innerHTML=enclosureInspector(t.project().enclosure,t.api.esc);}
 function style(type){render();const input=$('[data-closure-style]');input.value=type;input.dispatchEvent(new t.window.Event('change',{bubbles:true}));assert.equal(t.project().enclosure.closure.type,type);}
 for(const type of ['internal','external','slide','hinge','snap','plain'])style(type);assert.equal(JSON.stringify(t.project().features),original);
 style('internal');render();$('[data-closure-settings]').click();$('[name=fastener]').value='1/8 in';$('[name=engagement]').value='12 mm';let form=$('#closureForm');form.onsubmit({preventDefault(){},currentTarget:form});assert.equal(t.project().enclosure.closure.fastener,3.175);assert.equal(t.project().enclosure.closure.engagement,12);assert.equal($('#modal').open,false);
 render();$('[data-closure-settings]').click();const saved=JSON.stringify(t.project());$('[name=boss]').value='1 mm';form=$('#closureForm');form.onsubmit({preventDefault(){},currentTarget:form});assert.equal($('#closureError').hidden,false);assert.equal(JSON.stringify(t.project()),saved);$('[data-close]').click();assert.equal(JSON.stringify(t.project()),saved);
});
