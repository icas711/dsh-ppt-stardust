// Public synthetic inputs, never derived from a user's attachment.
import {PNG} from 'pngjs'
import {GENERATION_ICON_IDS} from '../../skills/dsh-ppt/scripts/deck-generation-compose.mjs'

export const sourceRefs=['source-1']
export const context={sources:[{id:'source-1',text:'Controlled synthetic fixture: project descriptions, dated stages, status comparison, 30 and 15 videos; original two-colour image.'}]}
export function picture(){const png=new PNG({width:2,height:1});png.data.set([255,0,0,255,0,0,255,255]);return {mime:'image/png',width:2,height:1,data:'data:image/png;base64,'+PNG.sync.write(png).toString('base64')}}
export function template({dark=false,page={width:9906000,height:6858000}}={}){
  const text=(id,y,h,size)=>({id,type:'text',role:'content',frame:{x:500000,y,w:page.width-1000000,h},textStyle:{fontFamily:'Arial',size,color:dark?'#FFFFFF':'#202020'},paragraphs:[{runs:[{text:'SAMPLE MUST DISAPPEAR'}]}]})
  return {manifest:{schemaVersion:3,id:'compose-test',name:'Components',revision:1,style:{pageSize:page,brand:{primaryColor:'#2864B4'},layouts:['cover','content'].map(purpose=>({id:purpose,name:purpose,purpose,backgroundColor:dark?'#121826':'#FFFFFF',slots:[],elements:[{id:'stripe',role:'decor',type:'shape',preset:'rect',frame:{x:0,y:0,w:100000,h:page.height},fill:{color:'#2864B4'}},text('sample-title',300000,600000,32),text('sample-body',1600000,page.height-2200000,18)]}))},assetMap:{}},assets:{},report:{objects:[],warnings:[]}}
}
const items=n=>Array.from({length:n},(_,i)=>({id:'item-'+i,label:'Project '+(i+1),detail:'Source detail '+(i+1)}))
export function visuals(){return [
  {type:'cards',sourceRefs,items:items(3).map((item,i)=>({...item,iconId:GENERATION_ICON_IDS[i]}))},
  {type:'process',sourceRefs,ordered:true,items:items(3)},
  {type:'timeline',sourceRefs,ordered:true,items:items(3).map((item,i)=>({...item,date:'2026-0'+(i+1)}))},
  {type:'comparison',sourceRefs,criteria:['Status','Coverage'],items:items(2).map((item,i)=>({...item,values:[i?'Ready':null,'Full']}))},
  {type:'big_number',sourceRefs,items:items(2).map((item,i)=>({...item,value:i?15:30,unit:'videos'}))},
  {type:'chart',sourceRefs,kind:'column',unit:'videos',categories:['Project A','Project B'],series:[{name:'Count',values:[30,15]}]},
  {type:'table',sourceRefs,headers:['Project','Status'],rows:[['Avatar','Ready'],['Assistant',null]]},
  {type:'image',sourceRefs,assetId:'photo',alt:'Source image',caption:'Original screenshot'}
]}
export const spec=(values=visuals())=>({version:1,title:'Projects',lang:'ru',mode:'factual',slides:values.map((visual,i)=>({id:'slide-'+(i+1),purpose:'content',title:'Результат проекта '+(i+1),notes:'Preserve speaker notes',visual}))})
export {items}
