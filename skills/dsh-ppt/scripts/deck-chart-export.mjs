import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate'

// office-kit omits invertIfNegative=false. PowerPoint defaults the missing
// element to true, whitening negative bars even when an explicit fill exists.
// Only run on the newly constructed scene-chart export, never imported bytes.
export function preserveSceneChartFormatting(bytes){
 const parts=unzipSync(new Uint8Array(bytes));let changed=false
 for(const name of Object.keys(parts).filter(n=>/^ppt\/charts\/chart\d+\.xml$/.test(n))){
  const xml=strFromU8(parts[name])
  let next=xml.replace(/<c:barChart\b[^>]*>[\s\S]*?<\/c:barChart>/g,bar=>bar.replace(/<c:ser\b[^>]*>[\s\S]*?<\/c:ser>/g,series=>{
   if(/<c:invertIfNegative\b/.test(series)||!/<c:val\b[^>]*>[\s\S]*?<c:v>\s*-/.test(series))return series
   return series.replace('</c:spPr>','</c:spPr><c:invertIfNegative val="0"/>')
  }))
  // Custom label text is emitted without run properties by office-kit.
  // PowerPoint otherwise uses black even with a light label textStyle.
  next=next.replace(/<c:dLbl>[\s\S]*?<\/c:dLbl>/g,label=>{
   const style=/<c:txPr>[\s\S]*?(<a:defRPr\b[^>]*>[\s\S]*?<\/a:defRPr>)/.exec(label)?.[1]
   if(!style)return label
   const run=style.replace('a:defRPr','a:rPr').replace('/a:defRPr','/a:rPr')
   return label.replace(/<c:rich>[\s\S]*?<\/c:rich>/g,rich=>rich.replace(/<a:r>(?!<a:rPr\b)/g,'<a:r>'+run))
  })
  if(next!==xml){parts[name]=strToU8(next);changed=true}
 }
 return changed?Buffer.from(zipSync(parts,{level:6})):bytes
}
