// Deterministic presentation timeline. No project mutations or wall-clock recording.
export const MOVIE_CHAPTERS=[
 {name:'Closed assembly',weight:3},
 {name:'Reveal the interior',weight:3},
 {name:'Transparent · 360°',weight:10},
 {name:'Explode',weight:4},
 {name:'Exploded · 360°',weight:10},
 {name:'Reassemble',weight:4},
 {name:'Final studio view',weight:6}
];
export const movieDefaults=()=>({duration:40,resolution:'1080',fps:30,quality:'high',background:'warm',explosion:1,ghostOpacity:.12,elevation:28,includeHidden:true});
export function normalizeMovieOptions(raw={}){
 const p=movieDefaults();for(const [key,min,max] of [['duration',20,60],['explosion',.4,2],['ghostOpacity',.04,.35],['elevation',10,65]]){const v=raw[key]??p[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${key}: enter ${min}–${max}.`);p[key]=v;}
 for(const [key,values] of [['resolution',['720','1080']],['quality',['standard','high']],['background',['warm','white','dark']]]){const v=raw[key]??p[key];if(!values.includes(v))throw Error('Unsupported movie '+key);p[key]=v;}
 p.fps=raw.fps??30;if(![24,30].includes(p.fps))throw Error('Movie frame rate must be 24 or 30 fps.');p.includeHidden=raw.includeHidden!==false;return p;
}
export const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(x*(x*6-15)+10);};
export function movieChapters(duration=40){let start=0;return MOVIE_CHAPTERS.map(c=>{const result={...c,start,end:start+c.weight*duration/40};start=result.end;return result;});}
export function movieState(time,options=movieDefaults()){
 const o=normalizeMovieOptions(options),t=Math.max(0,Math.min(o.duration,time)),chapters=movieChapters(o.duration);let index=chapters.findIndex(c=>t<c.end);if(index<0)index=6;const c=chapters[index],progress=Math.max(0,Math.min(1,(t-c.start)/(c.end-c.start))),s=ease(progress);
 let opacity=1,explode=0,azimuth=0,hero=0;
 if(index===1)opacity=1+(o.ghostOpacity-1)*s;
 if(index===2){opacity=o.ghostOpacity;azimuth=s*Math.PI*2;}
 if(index===3){opacity=o.ghostOpacity+(1-o.ghostOpacity)*s;explode=s;azimuth=Math.PI*2;}
 if(index===4){explode=1;azimuth=Math.PI*2+s*Math.PI*2;}
 if(index===5){explode=1-s;azimuth=Math.PI*4;}
 if(index===6){azimuth=Math.PI*4+ease(Math.min(progress/.65,1))*Math.PI/12;hero=s;}
 return {time:t,index,name:c.name,progress,opacity,explode:explode*o.explosion,azimuth,hero};
}
export function movieDimensions(options){return options.resolution==='720'?{width:1280,height:720}:{width:1920,height:1080};}
export function movieFrames(options){return Math.round(options.duration*options.fps);}
export function movieFrameTime(index,options){const n=movieFrames(options);if(!Number.isInteger(index)||index<0||index>=n)throw Error('Movie frame is outside the sequence.');return index/(n-1)*options.duration;}
export function movieFilename(title){return (String(title||'mockupbench').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').slice(0,90)||'mockupbench')+'-presentation.mp4';}
