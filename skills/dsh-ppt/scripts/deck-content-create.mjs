// Shared normal-create source contract and template selection; no model calls.
import {generationSpecSchema} from './deck-generation-spec.mjs'
import {composeGenerationSpec} from './deck-generation-compose.mjs'

export function contentSourcesSchema(){
  const id=generationSpecSchema().properties.slides.items.properties.id
  return {type:'array',minItems:1,maxItems:64,items:{type:'object',additionalProperties:false,required:['id','text'],properties:{id,text:{type:'string',minLength:1,maxLength:262144,pattern:'\\S'},synthetic:{type:'boolean'}}}}
}
export function validContentSources(sources){
  return Array.isArray(sources)&&sources.length>=1&&sources.length<=64&&sources.every(s=>s!==null&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).every(k=>['id','text','synthetic'].includes(k))&&typeof s.id==='string'&&s.id.length<=128&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(s.id)&&typeof s.text==='string'&&s.text.trim().length>0&&s.text.length<=262144&&(s.synthetic===undefined||typeof s.synthetic==='boolean'))
}
export function composeTemplateContent(input,options){
  const spec=structuredClone(input)
  // Prefer fewer physical pages, then more usable space, within this template.
  // An explicit reference is never replaced; no fallback to a different template.
  for(const slide of spec.slides){
    if(slide.designLayout)continue
    let lastError,best
    for(const layout of options.template?.manifest?.style?.layouts??[]){
      if(layout.purpose!=='content')continue
      try{
        const candidate=composeGenerationSpec({...spec,slides:[{...slide,designLayout:layout.id}]},options)
        const pages=candidate.report.slideCount,space=Math.min(...candidate.report.placements.map(p=>p.region.w*p.region.h))
        if(!best||pages<best.pages||(pages===best.pages&&space>best.space))best={id:layout.id,pages,space}
      }catch(e){
        if(!['component-capacity','component-slide-limit'].includes(e.code))throw e
        lastError=e
      }
    }
    if(best)slide.designLayout=best.id
    else if(lastError)throw lastError
  }
  return composeGenerationSpec(spec,options)
}
