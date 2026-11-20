import {transformedBounds, transformPoint, IDENTITY_TRANSFORM} from './deck-geometry.mjs'
import {mergeSceneTextStyles} from './deck-model.mjs'

// Derived hints only: never persist these percentages as a second geometry.
export function compositionGuides(layout, pageSize) {
  const {width, height} = pageSize ?? {}
  if (!(width > 0) || !(height > 0)) throw new Error('Composition guides require the actual page size')
  const percent = (value, axis) => Math.round(value / axis * 10000) / 100
  const area = frame => ({left:percent(frame.x,width),top:percent(frame.y,height),width:percent(frame.w,width),height:percent(frame.h,height)})
  const text = [], decor = []
  for (const element of layout.elements ?? []) {
    if (!element.frame) continue
    const transform = element.transform ?? IDENTITY_TRANSFORM
    // Scene children already carry final transforms; do not apply groups twice.
    const transformed = transform.some((v,i) => v !== IDENTITY_TRANSFORM[i])
    const base = {id:element.id,name:element.name ?? element.id,referenceArea:area(transformedBounds(element.frame,transform))}
    if (element.role === 'decor') {
      decor.push({...base,type:element.type})
    } else if (element.type === 'text') {
      let paragraph, run
      for (const p of element.paragraphs ?? []) {
        const r = p.runs?.find(r => !r.break && r.text?.trim())
        if (r) { paragraph=p;run=r;break }
      }
      paragraph ??= element.paragraphs?.[0]
      run ??= paragraph?.runs?.find(r => !r.break)
      const alignment = paragraph?.style?.align ?? element.textFrame?.align ?? 'left'
      const horizontal = ['right','center'].includes(alignment) ? alignment : 'left'
      const frame = element.frame
      const anchor = transformPoint({x:frame.x+(horizontal==='right'?frame.w:horizontal==='center'?frame.w/2:0),y:frame.y},transform)
      const oriented = transform[1]!==0 || transform[2]!==0 || transform[0]<0 || transform[3]<0
      text.push({...base,alignment,anchor:{horizontal,x:percent(anchor.x,width),y:percent(anchor.y,height)},
        typography:mergeSceneTextStyles(element.textStyle,run?.style),typographyUnits:{size:'pt'},
        ...(transformed?{transformed:true}:{}),
        ...(oriented?{referenceAreaKind:'transformedBoundingBox',anchorLimitation:'Rotated/reflected text: bounds are not the typesetting frame; preserve frame/transform semantics rather than applying x = R - W to these bounds.'}:{})})
    }
  }
  return {units:'percentOfPage',text,decor}
}
