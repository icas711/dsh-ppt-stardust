// Scene inputs paired with the independently authored OOXML sources. These are
// full-content cases, not the older lossy PPTX -> template refill projection.
import { fixtures, page } from './generate.mjs'
import { unzipSync } from 'fflate'

const frame = (x,y,w,h) => ({x,y,w,h})
const text = (id,bounds,value) => ({id,type:'text',frame:bounds,textStyle:{fontFamily:'Liberation Sans',size:18,color:'#202020',bold:false,italic:false},textFrame:{align:'left',anchor:'top',autoFit:'none',wrap:'square',margins:{left:0,right:0,top:0,bottom:0}},paragraphs:[{runs:[{text:value}]}]})
const title = () => text('title',frame(500000,250000,8800000,600000),'Synthetic fixture')
export function sceneFixtures() {
  const sources = new Map(fixtures().map(f=>[f.id,f.bytes]))
  const png = Buffer.from(unzipSync(sources.get('artwork'))['ppt/media/preview.png'])
  const image = {mime:'image/png',width:32,height:16,data:'data:image/png;base64,'+png.toString('base64')}
  const typography = text('title',frame(500000,800000,8000000,1600000),'')
  typography.paragraphs = [{runs:[{text:'Bold red',style:{bold:true,color:'#CF1F2F'}},{break:true},{text:'Second line'}]},{runs:[{text:'New paragraph',style:{italic:true}}]}]
  const cases = [
    {id:'dense',elements:[title(),...Array.from({length:12},(_,i)=>text('block-'+i,frame(500000+i%3*3000000,1300000+Math.floor(i/3)*1200000,2600000,800000),'Independent block '+(i+1)))]},
    {id:'typography',elements:[typography]},
    {id:'groups',elements:[title(),text('grouped',frame(1500000,1700000,2000000,600000),'Grouped'),text('nested',frame(3700000,2600000,1400000,480000),'Nested'),text('separate',frame(500000,5300000,3000000,600000),'Same name, different ID'),{id:'inner',type:'group',frame:frame(3500000,2300000,2000000,1800000),children:['nested']},{id:'outer',type:'group',frame:frame(1000000,1400000,6000000,3600000),children:['grouped','inner']}]},
    {id:'artwork',assets:{image},elements:[title(),...Array.from({length:13},(_,i)=>({id:'logo-'+i,type:'image',role:'decor',assetId:'image',fit:'fill',frame:frame(300000+i%7*1300000,1200000+Math.floor(i/7)*1400000,900000,500000)})),{id:'line',type:'line',frame:frame(500000,5000000,7000000,0),stroke:{width:2,color:'#CF1F2F'}}]},
    {id:'layers',elements:[title(),{id:'red',type:'shape',role:'decor',frame:frame(1000000,2000000,5000000,3000000),preset:'rect',fill:{color:'#CF1F2F'}},{id:'blue',type:'shape',role:'decor',frame:frame(3000000,3000000,5000000,2000000),preset:'rect',fill:{color:'#2864B4'}}]},
  ]
  return cases.map(c=>({id:c.id,source:sources.get(c.id),manifest:{title:'Scene fixture',motion:false,language:'en',assets:c.assets ?? {},style:{pageSize:page,themeFonts:{majorLatin:'Liberation Sans',minorLatin:'Liberation Sans',majorEastAsian:'',minorEastAsian:'',majorComplexScript:'',minorComplexScript:''}},slides:[{id:c.id,layout:'scene',purpose:'content',label:c.id,elements:c.elements}]}}))
}

export function legacyFixtureStates() {
  return ['cover','section','bullets','statement','quote','closing'].map(layout=>({
    id:'legacy-'+layout,
    manifest:{title:'Legacy compatibility',theme:'data',language:'en',motion:false,assets:{},style:{pageSize:page,themeFonts:{majorLatin:'Liberation Sans',minorLatin:'Liberation Sans',majorEastAsian:'',minorEastAsian:'',majorComplexScript:'',minorComplexScript:''}},
      slides:[{id:'legacy-'+layout,layout,title:layout === 'quote' ? 'A short quotation' : 'Legacy '+layout,kicker:'Kicker',subtitle:layout === 'quote' ? 'Attribution' : 'Subtitle',bullets:layout === 'bullets' ? ['First point','Second point','Third point'] : [],text:'Body',notes:'Keep\nnotes'}]},
  }))
}
