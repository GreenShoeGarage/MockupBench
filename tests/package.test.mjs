import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import vm from 'node:vm';
import {VERSION} from '../dist/model.js';
const root=new URL('../dist/',import.meta.url);
async function list(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=new URL(entry.name+(entry.isDirectory()?'/':''),dir);if(entry.isDirectory())result.push(...await list(path));else result.push(path);}return result;}
test('offline manifest covers the full runtime, versions agree and all local module imports resolve',async()=>{
 const sw=await readFile(new URL('sw.js',root),'utf8');const files=JSON.parse(sw.match(/const FILES=(\[[^;]+\]);/)[1]);for(const path of await list(root)){const rel='./'+path.pathname.slice(root.pathname.length);if(/\.(?:js|css|svg|html|wasm|ttf)$/.test(rel)&&rel!=='./sw.js')assert.ok(files.includes(rel),'Missing offline asset '+rel);if(path.pathname.endsWith('.js')){const source=await readFile(path,'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g))await access(new URL(match[2],path));}}
 const index=await readFile(new URL('index.html',root),'utf8');assert.ok(index.includes('v'+VERSION));assert.ok(sw.includes(VERSION));assert.equal(JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version,VERSION);
});
test('service worker installs all assets, stays within its origin and falls back to cached navigation offline',async()=>{
 const events={},calls=[],scope='https://example.test/mockupbench/';const caches={open:async key=>({addAll:async list=>calls.push({key,list})}),keys:async()=>[],match:async req=>String(req).endsWith('/index.html')?'cached-page':undefined};const self={registration:{scope},clients:{claim:async()=>{}},addEventListener:(name,fn)=>events[name]=fn};vm.runInNewContext(await readFile(new URL('sw.js',root),'utf8'),{self,caches,URL,location:{origin:'https://example.test'},fetch:async()=>{throw Error('offline');}});let promise;events.install({waitUntil:p=>promise=p});await promise;assert.ok(calls[0].list.includes('./vendor/manifold.wasm'));assert.ok(calls[0].list.includes('./vendor/occt-import-js.wasm'));events.fetch({request:{method:'GET',url:scope+'?client=1',mode:'navigate'},respondWith:p=>promise=p});assert.equal(await promise,'cached-page');let intercepted=false;events.fetch({request:{method:'GET',url:'https://www.digikey.com/'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
