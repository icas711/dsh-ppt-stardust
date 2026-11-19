// Public templates and fixed plans; no model/network invocation or private source content.
export function generationFixture(count=8,n=12){
 const pageSize={width:9906000,height:6858000}
 const layouts=Array.from({length:count},(_,i)=>({id:'variant-'+i,name:'Variant '+i,familyId:'public-family',purpose:'content',elements:[{id:'body-'+i,type:'text',role:'content',frame:{x:500000+i*150000,y:500000+i*350000,w:7000000-i*400000,h:1800000},textStyle:{size:20,color:'#242424'},paragraphs:[{runs:[{text:'Sample content'}]}]}],slots:[{id:'body',elementId:'body-'+i,type:'text',name:'Body',required:true}]}))
 const plan=Array.from({length:n},(_,i)=>({id:'slide-'+i,variantId:layouts[i%count].id,intent:'Explain the supplied fact '+i,structure:'list',values:{body:'Public fact '+i},sources:['fixture:fact-'+i]}))
 return {schemaVersion:3,id:'public-'+count,name:'Public '+count,style:{pageSize,layouts},assetMap:{},plan}
}
export function mixedGenerationFixture(count=8){
 const fixture=generationFixture(count,12)
 fixture.style.layouts.forEach((l,i)=>{l.elements[0].frame={x:500000+i*60000,y:1200000+i*100000,w:8500000-i*100000,h:4500000-i*150000}})
 const examples=[
  {kind:'process',ordered:true,items:[{id:'a',label:'Analyze'},{id:'b',label:'Build'}]},
  {kind:'number',items:[{label:'Completed',value:12,unit:'tasks',source:'Fixture register'}]},
  {kind:'hierarchy',items:[{id:'a',label:'Parent'},{id:'b',label:'Child',parentId:'a'}]},
  {kind:'comparison',criteria:['Cost'],items:[{label:'Option A',values:['Low']},{label:'Option B',values:[null]}]},
  {kind:'timeline',ordered:true,items:[{label:'Start',date:'2026-01'},{label:'Finish',date:'2026-04'}]},
  {kind:'kpi',items:[{label:'Coverage',value:85,unit:'%'}]},
  null,
  {kind:'quote',items:[{label:'A shared goal',source:'Fixture author'}]},
  {kind:'cycle',repeats:true,items:[{label:'Measure'},{label:'Learn'}]},
  {kind:'cards',items:[{label:'Clarity'},{label:'Evidence'}]},
  null,
  {kind:'chart',chart:{kind:'column',categories:['A','B'],series:[{name:'Facts',values:[12,8]}]}},
 ]
 fixture.plan=fixture.plan.map((p,i)=>{const d=examples[i],body=d?.kind==='chart'?'A\nB\n12\n8':d?d.items.map(item=>item.label).join('\n'):'Public source fact '+i;return {...p,structure:d?.kind??'list',values:{body},...(d?{visual:{slotId:'body',diagram:{version:2,...d}}}:{})}})
 return fixture
}
