import {featureContours,faceFrame,panels,profileBounds,checkFeatures} from './geometry.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function hostPart(p,id){return id?.startsWith('@')?panels(p.enclosure).find(a=>a.id===id):p.parts.find(a=>a.id===id);}
function checkHost(part,face,artwork=false){if(!part)throw Error('Select a host part.');if(!artwork&&part.closureOps?.length)throw Error('This panel has 3D enclosure closure details. Use STL or the engineering drawing package; a planar profile would omit those details.');if(!artwork&&(part.kind!=='block'||(part.profile?.length&&!['top','bottom'].includes(face))))throw Error('Planar fabrication profiles support rectangular panels and top/bottom faces of custom outline panels. Use STL for this solid.');}
export function svgDrawing(project,id,face,artwork=false){
 const part=hostPart(project,id);checkHost(part,face,artwork);const frame=faceFrame(part.dims,face),[w,h]=frame.span;const features=project.features.filter(f=>f.host===id&&f.face===face&&f.visible);const colors={cutout:'#d13a35',deboss:'#305eaa',emboss:'#2e8056'};
 const warnings=checkFeatures(part,features);if(warnings.length)throw Error(warnings.join(' '));
 const path=loops=>loops.map(c=>c.map((pt,i)=>(i?'L':'M')+pt.map(n=>n.toFixed(5)).join(' ')).join(' ')+' Z').join(' ');
 const outer=part.profile?.length&&['top','bottom'].includes(face)?part.profile.map(([x,y])=>[x*part.dims[0],y*part.dims[1]*(face==='bottom'?-1:1)]):[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
 let contents=artwork?'':`<path d="${path([outer])}" fill="none" stroke="#111" stroke-width="0.15" data-operation="outline"/>`;
 for(const f of features){if(f.type==='decal'){if(artwork&&f.image)contents+=`<g transform="translate(${f.u},${f.v}) rotate(${f.angle}) scale(1,-1)"><image href="${esc(f.image)}" x="${-f.w/2}" y="${-f.h/2}" width="${f.w}" height="${f.h}" opacity="${f.opacity}"/></g>`;continue;}
  if(artwork)continue;contents+=`<path d="${path(featureContours(f))}" fill="none" stroke="${colors[f.type]}" stroke-width="0.15" data-operation="${f.type==='cutout'?(f.through?'through-cut':'pocket'):f.type}" data-depth-mm="${f.depth}"/>`;}
 return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="${-w/2} ${-h/2} ${w} ${h}"><title>${esc(part.name)} — ${esc(face)} ${artwork?'artwork':'profile'} (millimeters)</title><desc>MOCKUPBENCH. Verify scale and tooling allowances. Geometry is nominal; red through/pocket cut, blue deboss, green emboss. No kerf or tool-radius compensation.</desc><g transform="scale(1,-1)">${contents}</g></svg>`;
}
export function dxfDrawing(project,id,face){
 const part=hostPart(project,id);checkHost(part,face);const warnings=checkFeatures(part,project.features.filter(f=>f.host===id&&f.face===face));if(warnings.length)throw Error(warnings.join(' '));const frame=faceFrame(part.dims,face),[w,h]=frame.span;const loops=[{layer:'OUTLINE',pts:[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]}];
 if(part.profile?.length&&['top','bottom'].includes(face))loops[0].pts=part.profile.map(([x,y])=>[x*w,y*h*(face==='bottom'?-1:1)]);
 for(const f of project.features.filter(f=>f.host===id&&f.face===face&&f.visible&&f.type!=='decal'))for(const pts of featureContours(f))loops.push({layer:f.type==='cutout'?(f.through?'THROUGH_CUT':'POCKET_'+f.depth):f.type.toUpperCase()+'_'+f.depth,pts});
 let d='0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
 for(const loop of loops){d+=`0\nLWPOLYLINE\n100\nAcDbEntity\n8\n${loop.layer}\n100\nAcDbPolyline\n90\n${loop.pts.length}\n70\n1\n`;for(const [x,y] of loop.pts)d+=`10\n${x}\n20\n${y}\n`;}
 return d+'0\nENDSEC\n0\nEOF\n';
}
