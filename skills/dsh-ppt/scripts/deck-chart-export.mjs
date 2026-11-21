import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate'

// office-kit omits invertIfNegative=false. PowerPoint defaults the missing
// element to true, whitening negative bars even when an explicit fill exists.
// Only run on the newly constructed scene-chart export, never imported bytes.
export function preserveSignedChartFills(bytes){
 const parts=unzipSync(new Uint8Array(bytes));let changed=false
 for(const name of Object.keys(parts).filter(n=>/^ppt\/charts\/chart\d+\.xml$/.test(n))){
  const xml=strFromU8(parts[name])
  const next=xml.replace(/<c:barChart\b[^>]*>[\s\S]*?<\/c:barChart>/g,bar=>bar.replace(/<c:ser\b[^>]*>[\s\S]*?<\/c:ser>/g,series=>{
   if(/<c:invertIfNegative\b/.test(series)||!/<c:val\b[^>]*>[\s\S]*?<c:v>\s*-/.test(series))return series
   return series.replace('</c:spPr>','</c:spPr><c:invertIfNegative val="0"/>')
  }))
  if(next!==xml){parts[name]=strToU8(next);changed=true}
 }
 return changed?Buffer.from(zipSync(parts,{level:6})):bytes
}
