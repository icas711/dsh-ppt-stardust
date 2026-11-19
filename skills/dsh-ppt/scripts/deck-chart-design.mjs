// Defaults only for newly requested semantic charts; imported chart XML is untouched.
export function semanticChartDesign(chart,{accent,background,color,fontFamily,size=18}){
 const out=structuredClone(chart),label={...(fontFamily?{font:fontFamily}:{}),sizePt:size,color}
 // Additional series use deterministic tones of the template accent, not Office blue.
 const tone=i=>{
  if(!i)return accent
  const amount=.18+.42*((i-1)%5)/4,target=i%2?background:color
  return '#'+[1,3,5].map(p=>Math.round(parseInt(accent.slice(p,p+2),16)*(1-amount)+parseInt(target.slice(p,p+2),16)*amount).toString(16).padStart(2,'0')).join('').toUpperCase()
 }
 out.series=out.series.map((s,i)=>({...s,color:s.color??tone(i)}))
 if(out.title===undefined&&out.series.length===1)out.title=out.series[0].name
 out.titleStyle={...label,bold:true,...out.titleStyle}
 if(out.chartAreaFill===undefined)out.chartAreaFill=background
 if(out.plotAreaFill===undefined)out.plotAreaFill=background
 for(const key of ['categoryAxisLabelStyle','valueAxisLabelStyle'])out[key]={...label,...out[key]}
 if(out.legend===undefined)out.legend={position:out.series.length>1?'b':'none',textStyle:{...label}}
 else out.legend={...out.legend,textStyle:{...label,...out.legend.textStyle}}
 if(out.dataLabels===undefined&&out.categories.length<=12&&out.series.length<=4)out.dataLabels={showValue:true,...(['pie','doughnut'].includes(out.kind)?{showCategory:true}:{}),textStyle:{...label}}
 else if(out.dataLabels)out.dataLabels={...out.dataLabels,textStyle:{...label,...out.dataLabels.textStyle}}
 return out
}
