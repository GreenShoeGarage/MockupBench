import {movieDimensions,movieFrames,movieFrameTime,normalizeMovieOptions} from './movie.js';
const aborted=()=>new DOMException('Movie export cancelled.','AbortError');
export class MP4EncoderClient{
 constructor({WorkerClass=globalThis.Worker,signal}={}){
  if(!WorkerClass)throw Error('This browser does not support background video encoding.');this.worker=new WorkerClass(new URL('./mp4-worker.js',import.meta.url));this.pending=new Map();this.serial=0;this.closed=false;this.signal=signal;this.abort=()=>this.close(aborted());signal?.addEventListener('abort',this.abort,{once:true});
  this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data);};this.worker.onerror=e=>this.close(Error('MP4 encoder could not run. Reload the app or try a smaller resolution. '+(e.message||'')));if(signal?.aborted)this.close(aborted());
 }
 request(type,payload={},transfer=[]){if(this.closed)return Promise.reject(this.signal?.aborted?aborted():Error('Video encoder is closed.'));const id=++this.serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.close(Error('The video encoder stopped responding. Try 720p / Standard quality.')),60000);this.pending.set(id,{resolve,reject,timer});try{this.worker.postMessage({id,type,...payload},transfer);}catch(e){this.close(e);}});}
 close(error=aborted()){if(this.closed)return;this.closed=true;this.worker.terminate();this.signal?.removeEventListener('abort',this.abort);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
}
export async function encodeMovieFrames({options,renderFrame,signal,onProgress=()=>{},EncoderClass=MP4EncoderClient,yieldFrame=()=>new Promise(r=>setTimeout(r,0))}){
 const o=normalizeMovieOptions(options),dims=movieDimensions(o),total=movieFrames(o);const encoder=new EncoderClass({signal});
 try{
  await encoder.request('init',{...dims,fps:o.fps,quality:o.quality});
  for(let i=0;i<total;i++){if(signal?.aborted)throw aborted();let rgba=await renderFrame(movieFrameTime(i,o),i);if(signal?.aborted)throw aborted();if(!(rgba instanceof Uint8Array||rgba instanceof Uint8ClampedArray)||rgba.byteLength!==dims.width*dims.height*4)throw Error('The renderer returned an incomplete movie frame.');if(rgba.byteOffset||rgba.buffer.byteLength!==rgba.byteLength)rgba=rgba.slice();await encoder.request('frame',{rgba:rgba.buffer},[rgba.buffer]);onProgress({completed:i+1,total,progress:(i+1)/total,time:movieFrameTime(i,o)});if(i%4===0)await yieldFrame();}
  const result=await encoder.request('finish');if(signal?.aborted)throw aborted();if(result.frames!==total||!result.bytes?.byteLength)throw Error('MP4 frame count did not match the complete presentation.');return new Blob([result.bytes],{type:'video/mp4'});
 }finally{encoder.close();}
}
