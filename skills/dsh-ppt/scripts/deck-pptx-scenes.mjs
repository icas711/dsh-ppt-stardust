import {readNativeChart,readNativeTable} from './deck-native-objects.mjs'
import {posix} from 'node:path'
import {createHash} from 'node:crypto'
import {unzipSync} from 'fflate'
import {nativeShapeElement} from './deck-legacy-scene.mjs'
import {normalizeSceneSlide,normalizeSceneSlides} from './deck-model.mjs'
import {IDENTITY_TRANSFORM,composeTransforms,groupTransform,frameTransform} from './deck-geometry.mjs'
import {imageInfo} from './deck-image.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex')
const frame=b=>Object.fromEntries(['x','y','w','h'].map(k=>[k,Number(b[k])]))
function failure(message){throw new Error('dsh-ppt: '+message)}
/** Import actual slides, retaining every object or an explicit per-object diagnostic. Never copies OLE binaries. */
export async function importPptxScenes(bytes,{signal,strict=false}={}){
 if(!(bytes instanceof Uint8Array)||bytes.length>64*1024*1024)failure('PPTX must be bytes up to 64 MiB')
 let total=0,count=0
 const safeParts=unzipSync(bytes,{filter:e=>{total+=e.originalSize;if(++count>20000||total>64*1024*1024)failure('PPTX unpacked limit exceeded');return /^ppt\/media\/[^/]+\.(png|jpe?g)$/i.test(e.name)&&e.originalSize<=5*1024*1024 || /\.rels$/.test(e.name)&&e.originalSize<=1024*1024}})
 signal?.throwIfAborted()
 const lib=await import('@office-kit/pptx'),pres=await lib.loadPresentation(bytes),size=lib.getSlideSize(pres),assets={},report={objects:[],warnings:[]}
 const storeImage=(raw,path)=>{if(!raw||raw.length>5*1024*1024)failure('Missing/oversized safe raster preview: '+path);const data=Buffer.from(raw),info=imageInfo(data,path),id='img-'+hash(data);assets[id]={...info,data:`data:${info.mime};base64,${data.toString('base64')}`};return id}
 const slides=lib.getSlides(pres).map((slide,index)=>{
  const elements=[],slideId='slide-'+(index+1),part=lib.getSlidePartName(slide).replace(/^\//,''),seen=new Set()
  const visit=(shape,parent=IDENTITY_TRANSFORM,decor=false,depth=0)=>{
   signal?.throwIfAborted();if(depth>16)failure('Group nesting exceeds 16')
   const shapeId=String(lib.getShapeId(shape)),kind=lib.getShapeKind(shape),name=lib.getShapeName(shape)||kind,id='element-'+hash(part+'|'+shapeId+'|'+decor).slice(0,24)
   if(seen.has(id))return [];seen.add(id)
   const bounds=lib.getShapeBoundsResolved(pres,shape)??{x:0,y:0,w:1,h:1},box=frame(bounds),flip=lib.getShapeFlip(shape),rotation=lib.getShapeRotation(shape)
   const transform=composeTransforms(parent,frameTransform(box,{rotation:rotation??0,flipH:flip?.horizontal??false,flipV:flip?.vertical??false}))
   const common={id,type:'unsupported',name,role:decor||/logo/i.test(name)?'decor':'content',frame:box,transform,source:{part,shapeId,slide:index+1,kind}}
   const at=elements.length
   try{
    if(kind==='group'){
     const g=lib.getGroupTransform(shape);if(!g)failure('Missing group viewport')
     const matrix=composeTransforms(parent,groupTransform({...g,rotation:rotation??0,flipH:flip?.horizontal??false,flipV:flip?.vertical??false}))
     const children=lib.getGroupChildren(shape).flatMap(child=>visit(child,matrix,decor,depth+1))
     if(children.length)elements.push({...common,type:'group',children})
     return children.length?[id]:[]
    }
    let element
    if(lib.isChartShape(shape))element={...common,type:'chart',chart:readNativeChart(lib,shape)}
    else if(lib.isTableShape(shape))element={...common,type:'table',table:readNativeTable(lib,pres,shape)}
    else element=nativeShapeElement(lib,pres,shape,common,{font:'Liberation Sans',color:'#000000',allowTypeface:true},`slide ${index+1}, ${name}`,storeImage)
    normalizeSceneSlide({layout:'scene',elements:[element]},{assets})
    elements.push(element)
    report.objects.push({slide:index+1,elementId:id,shapeId,name,kind,mode:'native'})
   }catch(error){
    if(strict)throw error
    elements.splice(at)
    let previewAssetId
    try{
      let raw=lib.getShapeImageBytes(shape)
      if(!raw){
        const xml=lib.getShapeXmlString(shape),pic=/<p:pic\b[\s\S]*?<\/p:pic>/.exec(xml)?.[0],relId=pic&&/r:embed="([^"]+)"/.exec(pic)?.[1]
        const relPart=posix.join(posix.dirname(part),'_rels',posix.basename(part)+'.rels'),rels=Buffer.from(safeParts[relPart]??[]).toString('utf8')
        for(const rel of rels.match(/<Relationship\s[^>]*\/?>/g)??[]){
          if(/TargetMode="External"/.test(rel)||!relId||!rel.includes('Id="'+relId+'"')||!rel.includes('/image"'))continue
          const target=/Target="([^"]+)"/.exec(rel)?.[1],resolved=target&&posix.normalize(posix.join(posix.dirname(part),target))
          if(resolved&&/^ppt\/media\/[^/]+\.(png|jpe?g)$/i.test(resolved))raw=safeParts[resolved]
        }
      }
      previewAssetId=storeImage(raw,name)
    }catch{}
    elements.push({...common,type:'unsupported',sourceKind:kind,reason:error.message,...(previewAssetId?{previewAssetId}:{}),support:{mode:previewAssetId?'preview':'unsupported',reason:error.message}})
    report.objects.push({slide:index+1,elementId:id,shapeId,name,kind,mode:previewAssetId?'preview':'unsupported',reason:error.message})
   }
   return [id]
  }
  let background=lib.getSlideBackground(slide)
  if(background.kind==='inherit')background=lib.getSlideLayoutBackground(lib.getSlideLayout(slide))
  if(background.kind==='inherit')background=lib.getSlideMasterBackground(pres,lib.getSlideLayout(slide))
  let backgroundColor
  if(background.kind==='solid')backgroundColor=background.color
  else if(background.kind!=='inherit')report.warnings.push({slide:index+1,code:'background-unsupported',reason:'Background '+background.kind+' requires review'})
  // Master/layout decorations precede actual slide objects. Placeholder content comes only from actual slides.
  for(const shape of (lib.getSlideLayout(slide)?[...lib.getSlideMasterShapes(pres,lib.getSlideLayout(slide)),...lib.getSlideLayoutShapes(pres,lib.getSlideLayout(slide))]:[]))if(!lib.isShapePlaceholder(shape))visit(shape,IDENTITY_TRANSFORM,true)
  for(const shape of lib.getSlideShapes(slide))visit(shape)
  return {id:slideId,layout:'scene',label:lib.getSlideTitle(slide)||'Slide '+(index+1),notes:lib.getSlideNotes(slide)??'',...(backgroundColor?{backgroundColor}:{}),elements}
 })
 return {slides:normalizeSceneSlides(slides,{assets}),assets,pageSize:{width:Number(size.width),height:Number(size.height)},report}
}
