import {scenePptxPlacement} from './deck-scene-pptx.mjs'
import {extractTypography,embedFontAssets,fontInfo} from './deck-fonts.mjs'
import {readNativeChart,readNativeTable} from './deck-native-objects.mjs'
import {posix} from 'node:path'
import {createHash} from 'node:crypto'
import {unzipSync} from 'fflate'
import {nativeShapeElement} from './deck-legacy-scene.mjs'
import {normalizeSceneSlide,normalizeSceneSlides} from './deck-model.mjs'
import {IDENTITY_TRANSFORM,composeTransforms,groupTransform,frameTransform,transformedBounds} from './deck-geometry.mjs'
import {imageInfo} from './deck-image.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex')
const frame=b=>Object.fromEntries(['x','y','w','h'].map(k=>[k,Number(b[k])]))
function failure(message){throw new Error('dsh-ppt: '+message)}
/** Import actual slides, retaining every object or an explicit per-object diagnostic. Never copies OLE binaries. */
export async function importPptxScenes(bytes,{signal,strict=false}={}){
 signal?.throwIfAborted()
 if(!(bytes instanceof Uint8Array)||bytes.length>64*1024*1024)failure('PPTX must be bytes up to 64 MiB')
 let total=0,count=0
 const safeParts=unzipSync(bytes,{filter:e=>{total+=e.originalSize;if(++count>20000||total>64*1024*1024)failure('PPTX unpacked limit exceeded');return /^ppt\/media\/[^/]+\.(png|jpe?g)$/i.test(e.name)&&e.originalSize<=5*1024*1024 || /\.rels$/.test(e.name)&&e.originalSize<=1024*1024}})
 signal?.throwIfAborted()
 const lib=await import('@office-kit/pptx'),pres=await lib.loadPresentation(bytes),size=lib.getSlideSize(pres),assets={},report={objects:[],warnings:[]}
 const storeImage=(raw,path)=>{if(!raw||raw.length>5*1024*1024)failure('Missing/oversized safe raster preview: '+path);const data=Buffer.from(raw),info=imageInfo(data,path),id='img-'+hash(data);assets[id]={...info,data:`data:${info.mime};base64,${data.toString('base64')}`};return id}
 const slides=lib.getSlides(pres).map((slide,index)=>{
  const palette=lib.getPresentationTheme(pres),clrMap=lib.getEffectiveColorMap(slide)
  const resolveColor=value=>{if(!value||value.startsWith('#'))return value;const token=value.replace(/^scheme:/,'');const key=clrMap[token]??token;return palette?.[({dk1:'dark1',dk2:'dark2',lt1:'light1',lt2:'light2',hlink:'hyperlink',folHlink:'followedHyperlink'})[key]??key]??value}
  const elements=[],slideId='slide-'+(index+1),part=lib.getSlidePartName(slide).replace(/^\//,''),seen=new Set()
  const visit=(shape,parent=IDENTITY_TRANSFORM,decor=false,depth=0,origin=part)=>{
   signal?.throwIfAborted();if(depth>16)failure('Group nesting exceeds 16')
   const shapeId=String(lib.getShapeId(shape)),kind=lib.getShapeKind(shape),name=lib.getShapeName(shape)||kind,id='element-'+hash(origin+'|'+shapeId+'|'+decor).slice(0,24)
   if(seen.has(id))return [];seen.add(id)
   const bounds=lib.getShapeBoundsResolved(pres,shape)??{x:0,y:0,w:1,h:1},box=frame(bounds),flip=lib.getShapeFlip(shape),rotation=lib.getShapeRotation(shape)
   const transform=composeTransforms(parent,frameTransform(box,{rotation:rotation??0,flipH:flip?.horizontal??false,flipV:flip?.vertical??false}))
   const common={id,type:'unsupported',...(lib.isShapeHidden(shape)?{hidden:true}:{}),name,role:decor||/logo/i.test(name)?'decor':'content',frame:box,transform,source:{part:origin,shapeId,slide:index+1,kind}}
   const at=elements.length,reportAt=report.objects.length
   try{
    if(kind==='group'){
     const g=lib.getGroupTransform(shape);if(!g)failure('Missing group viewport')
     const matrix=composeTransforms(parent,groupTransform({...g,rotation:rotation??0,flipH:flip?.horizontal??false,flipV:flip?.vertical??false}))
     const children=lib.getGroupChildren(shape).flatMap(child=>visit(child,matrix,decor,depth+1,origin))
     if(children.length){elements.push({...common,type:'group',children});report.objects.push({slide:index+1,elementId:id,shapeId,name,kind,mode:'native'})}
     return children.length?[id]:[]
    }
    let element
    if(lib.isChartShape(shape))element={...common,type:'chart',chart:readNativeChart(lib,shape,{pres,onDiagnostic:reason=>{common.support={mode:'lossy',reason}}}),...(common.support?{support:common.support}:{})}
    else if(lib.isTableShape(shape))element={...common,type:'table',table:readNativeTable(lib,pres,shape)}
    else element=nativeShapeElement(lib,pres,shape,common,{font:'Liberation Sans',color:'#000000',allowTypeface:true,resolveColor,colorMap:clrMap,fieldProxySlide:slide},`slide ${index+1}, ${name}`,storeImage)
    normalizeSceneSlide({layout:'scene',elements:[element]},{assets})
    elements.push(element)
    report.objects.push({slide:index+1,elementId:id,shapeId,name,kind,mode:element.support?.mode??'native',...(element.support?.reason?{reason:element.support.reason}:{})})
   }catch(error){
    if(strict)throw error
    elements.splice(at)
    report.objects.splice(reportAt)
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
    elements.push({...common,...(common.frame.w<=0||common.frame.h<=0?{hidden:true}:{}),...(error.code==='scene-transform-unsupported'?{transform:IDENTITY_TRANSFORM}:{}),frame:error.code==='scene-transform-unsupported'?Object.fromEntries(Object.entries(transformedBounds(common.frame,common.transform)).map(([k,v])=>[k,Math.round(v)])):{...common.frame,w:Math.max(1,common.frame.w),h:Math.max(1,common.frame.h)},type:'unsupported',sourceKind:kind,reason:error.message,...(previewAssetId?{previewAssetId}:{}),support:{mode:previewAssetId?'preview':'unsupported',reason:error.message}})
    report.objects.push({slide:index+1,elementId:id,shapeId,name,kind,mode:previewAssetId?'preview':'unsupported',reason:error.message})
   }
   return [id]
  }
  let background=lib.getSlideBackground(slide),backgroundRaw=background.kind==='image'?lib.getSlideBackgroundImageBytes(slide):null
  if(background.kind==='inherit'){background=lib.getSlideLayoutBackground(lib.getSlideLayout(slide));if(background.kind==='image')backgroundRaw=lib.getSlideLayoutBackgroundImageBytes(pres,lib.getSlideLayout(slide))}
  if(background.kind==='inherit'){background=lib.getSlideMasterBackground(pres,lib.getSlideLayout(slide));if(background.kind==='image')backgroundRaw=lib.getSlideMasterBackgroundImageBytes(pres,lib.getSlideLayout(slide))}
  let backgroundColor,backgroundAssetId
  if(background.kind==='solid'){
    backgroundColor=background.color
    if(backgroundColor.startsWith('scheme:')){
      const token=backgroundColor.slice(7),mapped=lib.getEffectiveColorMap(slide)[token]??token,theme=lib.getPresentationTheme(pres)
      backgroundColor=theme?.[({dk1:'dark1',dk2:'dark2',lt1:'light1',lt2:'light2',hlink:'hyperlink',folHlink:'followedHyperlink'})[mapped]??mapped]
      if(!backgroundColor)failure('Unresolved slide background color '+token)
    }
  }
  else if(background.kind==='image'){try{backgroundAssetId=storeImage(backgroundRaw,'slide background')}catch(error){report.warnings.push({slide:index+1,code:'background-unsupported',reason:error.message});backgroundColor=palette?.light1??'#FFFFFF'}}
  else if(background.kind==='inherit')backgroundColor=palette?.light1??'#FFFFFF'
  else if(background.kind!=='inherit')report.warnings.push({slide:index+1,code:'background-unsupported',reason:'Background '+background.kind+' requires review'})
  // Master/layout decorations precede actual slide objects. Placeholder content comes only from actual slides.
  const layout=lib.getSlideLayout(slide)
  if(layout){
    for(const shape of lib.getSlideMasterShapes(pres,layout))if(!lib.isShapePlaceholder(shape))visit(shape,IDENTITY_TRANSFORM,true,0,lib.getSlideMasterPartName(slide))
    for(const shape of lib.getSlideLayoutShapes(pres,layout))if(!lib.isShapePlaceholder(shape))visit(shape,IDENTITY_TRANSFORM,true,0,lib.getSlideLayoutPartName(layout))
  }
  for(const shape of lib.getSlideShapes(slide))visit(shape)
  return {id:slideId,layout:'scene',label:lib.getSlideTitle(slide)||'Slide '+(index+1),notes:lib.getSlideNotes(slide)??'',...(backgroundColor?{backgroundColor}:{}),...(backgroundAssetId?{backgroundAssetId}:{}),elements}
 })
 const rawFonts={},typography=extractTypography(bytes,[],new Map(),rawFonts,report)
 const fonts=embedFontAssets((typography.fonts??[]).map(f=>{const data=rawFonts[f.file],info=fontInfo(data);return {family:f.family,variant:f.variant,src:`data:${info.mime};base64,${Buffer.from(data).toString('base64')}`}}),assets)
 return {slides:normalizeSceneSlides(slides,{assets}),assets,fonts,sourceTheme:lib.getPresentationTheme(pres),themeFonts:lib.getPresentationFonts(pres),pageSize:{width:Number(size.width),height:Number(size.height)},report}
}
