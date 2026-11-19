// Independently specified expected geometry/text, serialized without product OOXML code.
import {packageDeck,page} from './generate.mjs'
import {diagramToScene} from '../../../skills/dsh-ppt/scripts/deck-diagrams.mjs'
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
const region={x:1000000,y:1000000,w:6000000,h:4000000}
const text=(x,y,w,h,label,size=18,bold=false)=>({kind:'text',x,y,w,h,label,size,bold})
const box=(x,y,w,h)=>({kind:'shape',x,y,w,h})
const line=(x,y,w,h,flipV=false)=>({kind:'line',x,y,w,h,flipV})
const cases=[
 ['cards',{kind:'cards',items:[{label:'Clarity'}]},[box(1360000,1400000,5280000,2600000),text(1360000,1400000,5280000,2600000,'Clarity')]],
 ['kpi',{kind:'kpi',items:[{label:'Coverage',value:85,unit:'%'}]},[box(1360000,1400000,5280000,2600000),text(1360000,1400000,5280000,2600000,'85 %\nCoverage')]],
 ['quote',{kind:'quote',items:[{label:'A shared goal',source:'Fixture author'}]},[text(1000000,1000000,6000000,2800000,'A shared goal',24,true),text(1000000,4000000,6000000,800000,'Fixture author')]],
 ['number',{kind:'number',items:[{label:'Completed',value:12,unit:'tasks',source:'Fixture register'}]},[text(1000000,1000000,6000000,2800000,'12 tasks\nCompleted',40,true),text(1000000,4000000,6000000,800000,'Fixture register')]],
 ['comparison',{kind:'comparison',criteria:['Cost'],items:[{label:'Option A',values:['Low']},{label:'Option B',values:[null]}]},[box(1180000,1400000,2640000,2600000),text(1180000,1400000,2640000,2600000,'Option A\nCost: Low'),box(4180000,1400000,2640000,2600000),text(4180000,1400000,2640000,2600000,'Option B\nCost: —')]],
 ['timeline',{kind:'timeline',ordered:true,items:[{label:'Start',date:'2026-01'},{label:'Finish',date:'2026-04'}]},[line(3820000,2700000,360000,0),box(1180000,1400000,2640000,2600000),text(1180000,1400000,2640000,2600000,'2026-01\nStart'),box(4180000,1400000,2640000,2600000),text(4180000,1400000,2640000,2600000,'2026-04\nFinish')]],
 ['cycle',{kind:'cycle',repeats:true,items:[{label:'Measure'},{label:'Learn'}]},[line(4000000,2200000,0,1600000),line(4000000,2200000,0,1600000,true),box(3280000,1240000,1440000,960000),text(3280000,1240000,1440000,960000,'Measure'),box(3280000,3800000,1440000,960000),text(3280000,3800000,1440000,960000,'Learn')]],
 ['kpi-typography',{kind:'kpi',items:[{label:'Coverage',value:85,unit:'%'}]},[
  {...text(1360000,1240000,5160000,1280000,'85 %',44,true),align:'left'},
  {...text(1360000,2600000,5160000,1280000,'Coverage'),align:'left'}
 ],{textStyles:{title:{size:44,bold:true},body:{size:18,bold:false}}}],
 ['comparison-typography',{kind:'comparison',criteria:['Cost'],items:[{label:'Option A',values:['Low']},{label:'Option B',values:[null]}]},[
  {...text(2531200,1000000,2097600,1360000,'Option A',24,true),align:'left'},
  {...text(4811200,1000000,2097600,1360000,'Option B',24,true),align:'left'},
  {...line(1000000,2360000,6000000,0),strokeWidth:12700,arrow:false},
  {...text(1000000,2360000,1353600,2640000,'Cost',14),align:'left'},
  {...text(2531200,2360000,2097600,2640000,'Low'),align:'left'},
  {...text(4811200,2360000,2097600,2640000,'—'),align:'left'}
 ],{textStyles:{subtitle:{size:24,bold:true},body:{size:18,bold:false},caption:{size:14,bold:false}}}],
]
function nativeObject(e,i){
 const xfrm=`<a:xfrm${e.flipV?' flipV="1"':''}><a:off x="${e.x}" y="${e.y}"/><a:ext cx="${e.w}" cy="${e.h}"/></a:xfrm>`
 const identity=`<p:cNvPr id="${i+2}" name="Reference ${i}"/>`,stroke='<a:ln w="'+(e.strokeWidth??19050)+'"><a:solidFill><a:srgbClr val="2864B4"/></a:solidFill><a:prstDash val="solid"/>'
 if(e.kind==='line')return `<p:cxnSp><p:nvCxnSpPr>${identity}<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm}<a:prstGeom prst="line"><a:avLst/></a:prstGeom>${stroke}${e.arrow===false?'':'<a:tailEnd type="triangle"/>'}</a:ln></p:spPr></p:cxnSp>`
 const sp=`<p:sp><p:nvSpPr>${identity}<p:cNvSpPr${e.kind==='text'?' txBox="1"':''}/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm}<a:prstGeom prst="${e.kind==='text'?'rect':'roundRect'}"><a:avLst/></a:prstGeom>`
 if(e.kind==='shape')return sp+`<a:solidFill><a:srgbClr val="F3F5F8"/></a:solidFill>${stroke}</a:ln></p:spPr></p:sp>`
 const paragraphs=e.label.split('\n').map(s=>`<a:p><a:pPr algn="${e.align??'ctr'}"><a:buNone/></a:pPr><a:r><a:rPr lang="en-US" sz="${e.size*100}" b="${e.bold?1:0}" i="0"><a:solidFill><a:srgbClr val="202020"/></a:solidFill><a:latin typeface="Liberation Sans"/><a:ea typeface="Liberation Sans"/><a:cs typeface="Liberation Sans"/></a:rPr><a:t>${escape(s)}</a:t></a:r></a:p>`).join('')
 return sp+`<a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="40000" rIns="40000" tIns="40000" bIns="40000"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`
}
export function semanticSceneFixtures(){return cases.map(([id,diagram,reference,options])=>({id:'semantic-'+id,source:packageDeck(reference.map(nativeObject).join('')),reference,manifest:{title:'Public semantic fixture',language:'en',motion:false,assets:{},style:{pageSize:page,themeFonts:{majorLatin:'Liberation Sans',minorLatin:'Liberation Sans',majorEastAsian:'',minorEastAsian:'',majorComplexScript:'',minorComplexScript:''}},slides:[diagramToScene({diagram:{version:2,...diagram}},{pageSize:page,region,fontFamily:'Liberation Sans',...options})]}}))}
