// Defaults only for newly requested semantic charts; imported chart XML is untouched.
import {colorContrast} from './deck-scene-quality.mjs'
import {refreshAmountLabels} from './deck-chart-labels.mjs'
export function semanticChartDesign(chart,{accent,background,color,fontFamily,size=18,unit,showPercent=false}){
 const out=structuredClone(chart),label={...(fontFamily?{font:fontFamily}:{}),sizePt:size,color}
 // Additional series use deterministic tones of the template accent, not Office blue.
 const tone=i=>{
  if(!i)return accent
  const amount=.18+.42*((i-1)%5)/4,target=i%2?background:color
  return '#'+[1,3,5].map(p=>Math.round(parseInt(accent.slice(p,p+2),16)*(1-amount)+parseInt(target.slice(p,p+2),16)*amount).toString(16).padStart(2,'0')).join('').toUpperCase()
 }
 out.series=out.series.map((s,i)=>({...s,color:s.color??tone(i)}))
 const pie=['pie','doughnut'].includes(out.kind),stacked=['stacked','percentStacked'].includes(out.grouping)
 // Keep signed bars clear of category labels at the zero axis.
 if(['bar','column'].includes(out.kind)&&out.series.some(s=>s.values.some(v=>v<0))){
  if(out.categoryAxisTickLabelPos===undefined)out.categoryAxisTickLabelPos='low'
 }
 if(pie&&chart.series[0].color===undefined&&out.series[0].pointColors===undefined&&out.varyColors!==false)out.series[0].pointColors=out.categories.map((_,i)=>tone(i))
 if(out.title===undefined&&out.series.length===1)out.title=out.series[0].name
 out.titleStyle={...label,bold:true,...out.titleStyle}
 if(out.chartAreaFill===undefined)out.chartAreaFill=background
 if(out.plotAreaFill===undefined)out.plotAreaFill=background
 for(const key of ['categoryAxisLabelStyle','valueAxisLabelStyle'])out[key]={...label,...out[key]}
 if(out.legend===undefined)out.legend={position:out.series.length>1?'b':'none',textStyle:{...label}}
 else out.legend={...out.legend,textStyle:{...label,...out.legend.textStyle}}
 if(out.dataLabels===undefined&&out.kind!=='area'&&out.categories.length<=12&&out.series.length<=4){
  out.dataLabels={showValue:true,...(out.kind==='doughnut'?{}:{position:pie?'outEnd':stacked?'ctr':out.kind==='line'?'t':'outEnd'}),...(pie?{showCategory:true,...(out.kind==='pie'?{showLeaderLines:true}:{})}:{}),textStyle:{...label}}
  if(out.kind==='pie'){
   Object.assign(out.dataLabels,{showValue:true,separator:', '})
   // Keep both the amount and its unit visible beside the share. Custom point
   // text avoids applying a currency number format to the percentage as well.
   const series=out.series[0]
   if(unit&&series.dataLabels===undefined&&series.pointDataLabels===undefined){
    out.dataLabels={...out.dataLabels,showValue:false,showPercent:false,showCategory:false}
    out.amountLabels={unit,showPercent}
    refreshAmountLabels(out)
   }
  }
  if(stacked)for(const series of out.series)if(series.dataLabels===undefined){
   const textColor=colorContrast(color,series.color)>=4.5?color:colorContrast('#FFFFFF',series.color)>colorContrast('#000000',series.color)?'#FFFFFF':'#000000'
   series.dataLabels={...out.dataLabels,textStyle:{...label,color:textColor}}
  }
  if(out.kind==='doughnut'&&out.series[0].dataLabels===undefined&&out.series[0].pointDataLabels===undefined){
   out.series[0].dataLabels={...out.dataLabels}
   out.series[0].pointDataLabels=out.categories.map((_,i)=>{
   const fill=out.series[0].pointColors?.[i]??out.series[0].color,textColor=colorContrast(color,fill)>=4.5?color:colorContrast('#FFFFFF',fill)>colorContrast('#000000',fill)?'#FFFFFF':'#000000'
   return {...out.dataLabels,textStyle:{...label,color:textColor}}
   })
  }
 }
 else if(out.dataLabels)out.dataLabels={...out.dataLabels,textStyle:{...label,...out.dataLabels.textStyle}}
 return out
}
