let db;
export async function openStore(){
 if(db)return db;
 db=await new Promise((resolve,reject)=>{const req=indexedDB.open('mockupbench',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return db;
}
export async function readSaved(){const d=await openStore();return new Promise((res,rej)=>{const r=d.transaction('projects').objectStore('projects').get('current');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
export async function saveProject(p){const d=await openStore();return new Promise((res,rej)=>{const tx=d.transaction('projects','readwrite');tx.objectStore('projects').put(p,'current');tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||Error('Save was interrupted.'));});}
export async function readRecord(key){const d=await openStore();return new Promise((res,rej)=>{const r=d.transaction('projects').objectStore('projects').get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
export async function saveRecord(key,value){const d=await openStore();return new Promise((res,rej)=>{const tx=d.transaction('projects','readwrite');tx.objectStore('projects').put(value,key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||Error('Save interrupted.'));});}
export async function saveCheckpoint(project){const d=await openStore();return new Promise((res,rej)=>{const tx=d.transaction('projects','readwrite'),store=tx.objectStore('projects'),req=store.get('recovery');req.onsuccess=()=>{const list=req.result||[];list.unshift({date:new Date().toISOString(),project});store.put(list.slice(0,5),'recovery');};tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||Error('Checkpoint interrupted.'));});}
