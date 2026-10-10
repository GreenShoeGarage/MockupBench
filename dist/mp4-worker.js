/* Dedicated, bundled software encoder. No network, native codec or SharedArrayBuffer required. */
importScripts('./vendor/h264-mp4-encoder.web.js');
let encoder=null,busy=false,frames=0;
self.onmessage=async({data})=>{
 const {id,type}=data;if(busy){self.postMessage({id,error:'Encoder request arrived before the previous frame finished.'});return;}busy=true;
 try{
  if(type==='init'){
   if(encoder)throw Error('The encoder is already running.');
   const {width,height,fps,quality}=data;if(![1280,1920].includes(width)||height!==width*9/16||![24,30].includes(fps))throw Error('Unsupported MP4 format.');
   encoder=await HME.createH264MP4Encoder();encoder.width=width;encoder.height=height;encoder.frameRate=fps;encoder.kbps=width===1920?(quality==='high'?18000:12000):(quality==='high'?10000:7000);encoder.speed=5;encoder.groupOfPictures=fps*2;encoder.initialize();frames=0;self.postMessage({id,ready:true});
  }else if(type==='frame'){
   if(!encoder)throw Error('MP4 encoder has not started.');const rgba=new Uint8Array(data.rgba);if(rgba.length!==encoder.width*encoder.height*4)throw Error('Unexpected movie frame size.');encoder.addFrameRgba(rgba);frames++;self.postMessage({id,frames});
  }else if(type==='finish'){
   if(!encoder||!frames)throw Error('No movie frames were encoded.');encoder.finalize();const bytes=new Uint8Array(encoder.FS.readFile(encoder.outputFilename));encoder.FS.unlink(encoder.outputFilename);encoder.delete();encoder=null;self.postMessage({id,bytes:bytes.buffer,frames},[bytes.buffer]);
  }else throw Error('Unknown movie encoder action.');
 }catch(error){try{encoder?.delete();}catch{}encoder=null;self.postMessage({id,error:error.message||String(error)});}finally{busy=false;}
};
