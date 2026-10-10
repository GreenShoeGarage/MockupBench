import * as T from 'three';
export function parseLength(value,units='mm'){
 const match=String(value).trim().toLowerCase().replace(/[″"]/g,' in').match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\s+\d+\s*\/\s*\d+)?|[+-]?\d+\s*\/\s*\d+)\s*(mm|cm|m|in|inch|inches|ft|feet|')?$/);
 if(!match)throw Error('Enter a dimension such as 50 mm, 2 in, or 1 1/2 in.');const a=match[1].trim();let n;if(a.includes('/')){const [top,bottom]=a.split('/'),terms=top.trim().split(/\s+/);if(Number(bottom)===0)throw Error('A fraction cannot have a zero denominator.');n=terms.length===2?Number(terms[0])+Math.sign(Number(terms[0])||1)*Number(terms[1])/Number(bottom):Number(top)/Number(bottom);}else n=Number(a);
 n*=({mm:1,cm:10,m:1000,in:25.4,inch:25.4,inches:25.4,ft:304.8,feet:304.8,"'":304.8}[match[2]||units]||1);if(!Number.isFinite(n))throw Error('Enter a finite dimension.');return n;
}
export function resizePart(part,axis,size,{linked=false,anchor='center'}={}){
 if(part.locked)throw Error('Unlock this component to resize it.');const old=[...part.dims],next=linked?old.map(n=>n*size/old[axis]):old.map((n,i)=>i===axis?size:n);if(next.some(n=>!Number.isFinite(n)||n<.01||n>5000))throw Error('Every part dimension must be 0.01–5000 mm.');
 const offset=[0,0,0];if(anchor==='bottom')offset[2]=(next[2]-old[2])/2;if(anchor==='min')for(let i=0;i<3;i++)offset[i]=(next[i]-old[i])/2;if(anchor==='max')for(let i=0;i<3;i++)offset[i]=(old[i]-next[i])/2;const delta=new T.Vector3(...offset).applyEuler(new T.Euler(...part.rot.map(x=>x*Math.PI/180)));part.pos=part.pos.map((n,i)=>n+delta.getComponent(i));part.dims=next;
 // Reference points remain proportional to the envelope; explicit surface cuts retain their physical dimensions.
 part.anchors=part.anchors.map(a=>({...a,pos:a.pos.map((n,i)=>n*next[i]/old[i])}));return part;
}
