import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {demoProject,validateProject} from '../dist/model.js';
import {readSaved,saveProject} from '../dist/storage.js';
test('IndexedDB autosave preserves the complete project across storage module reloads',async()=>{
 assert.equal(await readSaved(),undefined);const p=demoProject();p.parts[0].notes='Saved assembly evidence';await saveProject(p);const reload=await import('../dist/storage.js?reloaded');const saved=await reload.readSaved();assert.deepEqual(validateProject(saved),p);
 const second=structuredClone(p);second.parts[0].pos[0]=26;await saveProject(second);assert.equal((await reload.readSaved()).parts[0].pos[0],26);
});
