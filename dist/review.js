import * as T from 'three';
import {OBB} from './vendor/OBB.js';
import {inspect} from './model.js';
import {hostPart} from './fabrication.js';
import {checkFeatures} from './geometry.js';
export const findingKey=f=>f.ids.slice().sort().join('|')+'|'+(f.text.includes('enclosure walls')?'enclosure':f.ids.length>1?'overlap':f.text);
function box(p){return new OBB(new T.Vector3(...p.pos),new T.Vector3(...p.dims.map(n=>Math.max(0,n/2-.1))),new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...p.rot.map(a=>a*Math.PI/180)))));}
export function reviewProject(p){const boxes=new Map(p.parts.map(a=>[a.id,box(a)]));const findings=inspect(p).filter(f=>f.ids.length!==2||boxes.get(f.ids[0]).intersectsOBB(boxes.get(f.ids[1])));for(const f of findings){f.key=findingKey(f);if(p.dismissed.includes(f.key)){f.severity='Accepted';f.text+=' Accepted as intentional.';}}
 for(const f of p.features)try{const part=hostPart(p,f.host);for(const text of checkFeatures(part,[f]))findings.push({severity:'Review',confidence:'Dimensional',ids:[f.host],text,key:'feature|'+f.id});}catch(err){findings.push({severity:'Review',confidence:'Dimensional',ids:[f.host],text:err.message,key:'feature|'+f.id});}
 return findings;
}
