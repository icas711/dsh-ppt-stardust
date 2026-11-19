// Public templates and fixed plans; no model/network invocation or private source content.
export function generationFixture(count=8,n=12){
 const pageSize={width:9906000,height:6858000}
 const layouts=Array.from({length:count},(_,i)=>({id:'variant-'+i,name:'Variant '+i,familyId:'public-family',purpose:'content',elements:[{id:'body-'+i,type:'text',role:'content',frame:{x:500000+i*150000,y:500000+i*350000,w:7000000-i*400000,h:1800000},textStyle:{size:20,color:'#242424'},paragraphs:[{runs:[{text:'Sample content'}]}]}],slots:[{id:'body',elementId:'body-'+i,type:'text',name:'Body',required:true}]}))
 const plan=Array.from({length:n},(_,i)=>({id:'slide-'+i,variantId:layouts[i%count].id,intent:'Explain the supplied fact '+i,structure:'list',values:{body:'Public fact '+i},sources:['fixture:fact-'+i]}))
 return {schemaVersion:3,id:'public-'+count,name:'Public '+count,style:{pageSize,layouts},assetMap:{},plan}
}
